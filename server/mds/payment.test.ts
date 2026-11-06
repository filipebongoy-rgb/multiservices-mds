import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import express from "express";
import type { Server } from "node:http";
import * as s from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { hash } from "./common";

const boundary = vi.hoisted(() => ({
  db: null as any,
  create: vi.fn(),
  retrieve: vi.fn(),
  verify: vi.fn(),
  intentRetrieve: vi.fn(),
  refundList: vi.fn(),
  refundCreate: vi.fn(),
  refundRetrieve: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: { create: boundary.create, retrieve: boundary.retrieve },
    };
    webhooks = { constructEvent: boundary.verify };
    paymentIntents = { retrieve: boundary.intentRetrieve };
    refunds = {
      list: boundary.refundList,
      create: boundary.refundCreate,
      retrieve: boundary.refundRetrieve,
    };
  },
}));
import {
  commercialPaidCents,
  paymentConfig,
  paymentsRouter,
  validateCheckoutOrigin,
} from "./payments";
import { processPaymentEvent, registerPaymentWebhook } from "./payment-webhook";

type Row = Record<string, any>;
// Private mock: no dependence on the concurrent modifications of test-db.ts, no production import/write.
const dialect = new MySqlDialect();
function matches(sql: SQL | undefined, row: Row) {
  if (!sql) return true;
  const query = dialect.sqlToQuery(sql);
  const tokens =
    query.sql.match(
      /`[^`]+`(?:\.`[^`]+`)?|\(|\)|,|<=|>=|<>|!=|=|<|>|\?|\b\w+\b/g
    ) || [];
  let pos = 0;
  let parameter = 0;
  function value(): any {
    const token = tokens[pos++];
    if (token === "?") return query.params[parameter++];
    if (token.startsWith("`")) {
      const pieces = token.split("`").filter(x => x && x !== ".");
      return pieces.length > 1 ? row[pieces.join(".")] : row[pieces[0]];
    }
    return token === "true"
      ? true
      : token === "false"
        ? false
        : token === "null"
          ? null
          : token;
  }
  function atom(): boolean {
    if (tokens[pos] === "(") {
      pos++;
      const result = disjunction();
      pos++;
      return result;
    }
    const a = value();
    const op = tokens[pos];
    if (!op || [")", "and", "or"].includes(op)) return !!a;
    pos++;
    if (op === "is") {
      const not = tokens[pos] === "not";
      if (not) pos++;
      pos++;
      return not ? a != null : a == null;
    }
    if (op === "in") {
      pos++;
      const values: any[] = [];
      while (tokens[pos] !== ")") {
        if (tokens[pos] === ",") pos++;
        else values.push(value());
      }
      pos++;
      return values.includes(a);
    }
    const b = value();
    const left = a instanceof Date ? a.getTime() : a;
    const right = b instanceof Date ? b.getTime() : b;
    switch (op) {
      case "=":
        return left === right;
      case "<>":
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        throw new Error(`Unsupported SQL: ${query.sql}`);
    }
  }
  function conjunction(): boolean {
    let r = atom();
    while (tokens[pos] === "and") {
      pos++;
      const right = atom();
      r = r && right;
    }
    return r;
  }
  function disjunction(): boolean {
    let r = conjunction();
    while (tokens[pos] === "or") {
      pos++;
      const right = conjunction();
      r = r || right;
    }
    return r;
  }
  return disjunction();
}
class PaymentTestDatabase {
  tables: Record<string, Row[]> = {};
  operations: { table: string; operation: string; locked: boolean }[] = [];
  queue = Promise.resolve();
  rows(table: any) {
    return (this.tables[getTableName(table)] ||= []);
  }
  put(table: any, rows: Row[]) {
    this.tables[getTableName(table)] = structuredClone(rows);
    return this;
  }
  clear() {
    this.tables = {};
    this.operations = [];
    this.queue = Promise.resolve();
  }
  async transaction<T>(callback: (tx: any) => Promise<T>) {
    let release: (() => void) | undefined;
    let snapshot: typeof this.tables | undefined;
    const acquire = async () => {
      if (!release) {
        const previous = this.queue;
        this.queue = new Promise<void>(resolve => {
          release = resolve;
        });
        await previous;
        snapshot = structuredClone(this.tables);
      }
    };
    try {
      return await callback(this.builders(acquire));
    } catch (e) {
      if (snapshot) this.tables = snapshot;
      throw e;
    } finally {
      release?.();
    }
  }
  select(fields?: Row) {
    return this.query("select", fields);
  }
  insert(table: any) {
    return this.query("insert").from(table);
  }
  update(table: any) {
    return this.query("update").from(table);
  }
  builders(acquire: () => Promise<void>) {
    return {
      select: (fields?: Row) => this.query("select", fields, acquire),
      insert: (t: any) => this.query("insert", undefined, acquire).from(t),
      update: (t: any) => this.query("update", undefined, acquire).from(t),
    };
  }
  query(
    operation: string,
    fields?: Row,
    acquire: () => Promise<void> = async () => {}
  ) {
    let table: any;
    let condition: SQL | undefined;
    let locked = false;
    let data: Row = {};
    let max = Infinity;
    const joins: { table: any; sql: SQL }[] = [];
    const self = this;
    const query: any = {
      from(t: any) {
        table = t;
        return query;
      },
      where(sql: SQL) {
        condition = sql;
        return query;
      },
      for() {
        locked = true;
        return query;
      },
      orderBy() {
        return query;
      },
      limit(n: number) {
        max = n;
        return query;
      },
      innerJoin(t: any, sql: SQL) {
        joins.push({ table: t, sql });
        return query;
      },
      values(v: Row) {
        data = v;
        return query;
      },
      set(v: Row) {
        data = v;
        return query;
      },
      $returningId: async () => {
        const result = await execute();
        return [{ id: result[0].insertId }];
      },
      then: (yes: any, no: any) => execute().then(yes, no),
    };
    const qualify = (r: Row, t: any) =>
      Object.fromEntries(
        Object.entries(r).map(([key, val]) => [
          `${getTableName(t)}.${key}`,
          val,
        ])
      );
    async function execute() {
      const name = getTableName(table);
      if (locked && name === "mds_settings") await acquire();
      self.operations.push({ operation, table: name, locked });
      const rows = self.rows(table);
      if (operation === "select") {
        let contexts = rows.map(r => ({ ...r, ...qualify(r, table) }));
        for (const join of joins)
          contexts = contexts.flatMap(r =>
            self
              .rows(join.table)
              .map(other => ({ ...r, ...qualify(other, join.table) }))
              .filter(ctx => matches(join.sql, ctx))
          );
        const selected = contexts
          .filter(r => matches(condition, r))
          .slice(0, max);
        return selected.map(r =>
          fields
            ? Object.fromEntries(
                Object.entries(fields).map(([key, col]) => [
                  key,
                  r[`${getTableName(col.table)}.${col.name}`],
                ])
              )
            : Object.fromEntries(
                Object.entries(structuredClone(r)).filter(
                  ([key]) => !key.includes(".")
                )
              )
        );
      }
      if (operation === "insert") {
        for (const key of [
          "eventId",
          "checkoutKey",
          "checkoutSessionId",
          "paymentIntentId",
          "providerRefundId",
          "idempotencyKey",
        ])
          if (data[key] != null && rows.some(r => r[key] === data[key]))
            throw new Error(`Unique ${key}`);
        const id = Math.max(0, ...rows.map(r => r.id || 0)) + 1;
        const defaults =
          name === "mds_payments"
            ? {
                checkoutSessionId: null,
                paymentIntentId: null,
                verifiedBy: null,
                verificationNote: null,
                confirmedAt: null,
                expiresAt: null,
                receivedAmountCents: null,
                creditedAt: null,
                purpose: "full",
                planId: null,
                invoiceId: null,
              }
            : {};
        rows.push({
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...defaults,
          ...structuredClone(data),
        });
        return [{ insertId: id, affectedRows: 1 }];
      }
      const selected = rows
        .filter(r => matches(condition, { ...r, ...qualify(r, table) }))
        .slice(0, max);
      for (const r of selected) Object.assign(r, structuredClone(data));
      return [{ affectedRows: selected.length }];
    }
    return query;
  }
}
const db = new PaymentTestDatabase();
const token = "private-test-followup-capability-123";
const origin = "https://mds.example.test";
const user = (id: number, role: "user" | "admin" = "user"): s.User => ({
  id,
  role,
  name: `Client ${id}`,
  email: `client${id}@example.test`,
  openId: `test-${id}`,
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});
const context = (
  identity: s.User | null = null,
  headers: Row = { origin }
): TrpcContext => ({ user: identity, req: { headers } as any, res: {} as any });
const caller = (identity: s.User | null = null, headers?: Row) =>
  paymentsRouter.createCaller(context(identity, headers));
const input = { reference: "MDS-TEST-1", token, origin };
function request(id = 1, patch: Row = {}) {
  return {
    id,
    reference: `MDS-TEST-${id}`,
    trackingHash: hash(token),
    userId: 2,
    organizationId: null,
    name: "Client origine",
    email: "guest@example.test",
    serviceName: "Réparation",
    status: "invoiced",
    version: 4,
    ...patch,
  };
}
function invoice(patch: Row = {}) {
  return {
    id: 1,
    requestId: 1,
    documentId: 1,
    amountCents: 12000,
    currency: "EUR",
    paidAt: null,
    ...patch,
  };
}
function payment(patch: Row = {}) {
  return {
    id: 1,
    requestId: 1,
    invoiceId: 1,
    provider: "stripe",
    mode: "test",
    status: "pending",
    amountCents: 12000,
    currency: "EUR",
    checkoutKey: "test-durable-payment-key",
    checkoutSessionId: null,
    paymentIntentId: null,
    reference: "MDS-P-test",
    expiresAt: new Date(Date.now() + 3600000),
    confirmedAt: null,
    receivedAmountCents: null,
    creditedAt: null,
    purpose: "full",
    planId: null,
    ...patch,
  };
}
function session(params: any, patch: Row = {}) {
  return {
    object: "checkout.session",
    id: "cs_test_mock",
    livemode: false,
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    url: "https://checkout.stripe.com/c/pay/mock",
    expires_at: params.expires_at,
    client_reference_id: params.client_reference_id,
    metadata: params.metadata,
    payment_intent: "pi_mock",
    amount_total: 12000,
    currency: "eur",
    ...patch,
  };
}
function signedEvent(
  id = "evt_success",
  type = "payment_intent.succeeded",
  patch: Row = {},
  live = false
): any {
  return {
    object: "event",
    id,
    type,
    livemode: live,
    data: {
      object: {
        object: "payment_intent",
        id: "pi_mock",
        amount: 12000,
        amount_received: 12000,
        currency: "eur",
        status: "succeeded",
        livemode: live,
        metadata: {
          payment_id: "1",
          request_id: "1",
          invoice_id: "1",
          checkout_key: "test-durable-payment-key",
        },
        ...patch,
      },
    },
  };
}
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        server =>
          new Promise<void>((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve()))
          )
      )
  );
  vi.unstubAllEnvs();
});
beforeEach(() => {
  db.clear();
  boundary.db = db;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_tests_no_network");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit_test");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MDS_PUBLIC_ORIGIN", "");
  vi.stubEnv("PUBLIC_APP_ORIGIN", "");
  boundary.create.mockReset();
  boundary.retrieve.mockReset();
  boundary.verify.mockReset();
  boundary.intentRetrieve.mockReset();
  boundary.refundList.mockReset();
  boundary.refundCreate.mockReset();
  boundary.refundRetrieve.mockReset();
  boundary.intentRetrieve.mockResolvedValue({
    object: "payment_intent",
    id: "pi_mock",
    status: "succeeded",
    livemode: false,
    currency: "eur",
    amount_received: 12000,
  });
  boundary.refundList.mockResolvedValue({
    object: "list",
    data: [],
    has_more: false,
  });
  boundary.create.mockImplementation(async params => session(params));
  db.put(s.settings, [{ id: 1, artisanUserId: 1 }])
    .put(s.requests, [request()])
    .put(s.invoices, [invoice()]);
});

describe("configuration, permissions et montant de paiement", () => {
  it("ne révèle aucune clé et désactive Stripe sans clés/signature", async () => {
    expect(await caller().config()).toEqual({ enabled: true, mode: "test" });
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    expect(paymentConfig()).toEqual({ enabled: true, mode: "live" });
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(await caller().config()).toEqual({
      enabled: false,
      mode: "unavailable",
    });
    await expect(caller().checkout(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("exige l’appartenance organisation avant le token, y compris après révocation", async () => {
    db.put(s.requests, [request(1, { organizationId: 7, userId: 2 })]);
    await expect(caller().checkout(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(user(2)).list(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    db.put(s.members, [{ organizationId: 7, userId: 2, role: "member" }]);
    expect(await caller(user(2)).list(input)).toEqual([]);
    db.put(s.members, []);
    await expect(caller(user(2)).checkout(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("interdit les visiteurs/autres utilisateurs sans capability valide", async () => {
    await expect(
      caller().list({ reference: input.reference })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(user(3)).checkout({ reference: input.reference, origin })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it.each([null, 0, 49])(
    "refuse un montant legacy ou inférieur au minimum : %s",
    async amountCents => {
      db.put(s.invoices, [invoice({ amountCents })]);
      await expect(caller().checkout(input)).rejects.toThrow("0,50");
      expect(db.rows(s.payments)).toHaveLength(0);
      expect(boundary.create).not.toHaveBeenCalled();
    }
  );
  it("refuse facture manuellement réglée, dossier non facturé et devise autre que EUR", async () => {
    db.put(s.invoices, [invoice({ paidAt: new Date() })]);
    await expect(caller().checkout(input)).rejects.toThrow("déjà réglée");
    db.put(s.invoices, [invoice({ currency: "USD" })]);
    await expect(caller().checkout(input)).rejects.toThrow("euros");
    db.put(s.requests, [request(1, { status: "cancelled" })]);
    await expect(caller().checkout(input)).rejects.toThrow("facture émise");
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("valide origine exacte et navigateur, ne dérive jamais Host/X-Forwarded-Host", () => {
    expect(
      validateCheckoutOrigin(origin, {
        headers: { referer: `${origin}/suivi?token=local` },
      })
    ).toBe(origin);
    for (const value of [
      `${origin}/`,
      `${origin}/x`,
      "https://evil.example.test",
      "http://public.example.test",
      "https://user:pass@mds.example.test",
    ])
      expect(() => validateCheckoutOrigin(value, context().req)).toThrow();
    expect(() =>
      validateCheckoutOrigin(origin, {
        headers: {
          host: "mds.example.test",
          "x-forwarded-host": "mds.example.test",
        },
      })
    ).toThrow();
    expect(
      validateCheckoutOrigin("http://localhost:3000", {
        headers: { origin: "http://localhost:3000" },
      })
    ).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      validateCheckoutOrigin("http://localhost:3000", {
        headers: { origin: "http://localhost:3000" },
      })
    ).toThrow();
    vi.stubEnv("MDS_PUBLIC_ORIGIN", "https://other.example.test");
    expect(() => validateCheckoutOrigin(origin, context().req)).toThrow();
  });
  it("liste publique minimale et historique scoped avec référence dossier distincte", async () => {
    db.put(s.requests, [
      request(),
      request(2, { userId: 3 }),
      request(3, { organizationId: 7, userId: 3 }),
    ]);
    db.put(s.members, [{ organizationId: 7, userId: 2 }]);
    db.put(s.payments, [
      payment(),
      payment({ id: 2, requestId: 2 }),
      payment({ id: 3, requestId: 3 }),
    ]);
    const list = await caller().list(input);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("checkoutKey");
    expect(list[0]).not.toHaveProperty("paymentIntentId");
    expect(list[0]).not.toHaveProperty("verificationNote");
    const mine = await caller(user(2)).mine();
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({
      requestReference: "MDS-TEST-1",
      reference: "MDS-P-test",
      serviceName: "Réparation",
    });
    db.put(s.members, []);
    expect(await caller(user(2)).mine()).toHaveLength(1);
  });
});

describe("Checkout durable sans second débit", () => {
  it("utilise montant facture, identité invitée et métadonnées métier sans bearer dans Stripe", async () => {
    const result = await caller().checkout(input);
    const [params, options] = boundary.create.mock.calls[0];
    expect(result).toMatchObject({
      url: "https://checkout.stripe.com/c/pay/mock",
      mode: "test",
    });
    expect(params).toMatchObject({
      allow_promotion_codes: true,
      customer_email: "guest@example.test",
      client_reference_id: input.reference,
      success_url: `${origin}/paiements?ref=MDS-TEST-1&checkout=retour`,
      cancel_url: `${origin}/paiements?ref=MDS-TEST-1&checkout=annule`,
    });
    expect(params.line_items[0].price_data).toMatchObject({
      unit_amount: 12000,
      currency: "eur",
    });
    expect(params.payment_intent_data.metadata).toEqual(params.metadata);
    expect(params.metadata).toMatchObject({
      request_id: "1",
      invoice_id: "1",
      payment_id: "1",
      customer_email: "guest@example.test",
    });
    expect(JSON.stringify(params)).not.toContain(token);
    expect(options.idempotencyKey).toBe(db.rows(s.payments)[0].checkoutKey);
    expect(db.rows(s.payments)[0]).toMatchObject({
      checkoutSessionId: "cs_test_mock",
      paymentIntentId: "pi_mock",
      status: "pending",
    });
    expect(db.rows(s.payments)[0]).not.toHaveProperty("url");
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it("préfère l’identité OAuth authentifiée", async () => {
    await caller(user(2)).checkout({ reference: input.reference, origin });
    expect(boundary.create.mock.calls[0][0]).toMatchObject({
      customer_email: "client2@example.test",
      metadata: { user_id: "2", customer_name: "Client 2" },
    });
  });
  it("deux créations concurrentes partagent la réservation ET la clé provider", async () => {
    await Promise.all([caller().checkout(input), caller().checkout(input)]);
    expect(db.rows(s.payments)).toHaveLength(1);
    expect(
      new Set(boundary.create.mock.calls.map(call => call[1].idempotencyKey))
        .size
    ).toBe(1);
    expect(boundary.create.mock.calls[0][0]).toEqual(
      boundary.create.mock.calls[1][0]
    );
  });
  it("récupère une session après timeout avec EXACTEMENT les mêmes paramètres et clé", async () => {
    boundary.create.mockRejectedValueOnce(
      new Error("timeout after server creation")
    );
    await expect(caller().checkout(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.rows(s.payments)).toHaveLength(1);
    await caller().checkout(input);
    expect(boundary.create.mock.calls[0]).toEqual(
      boundary.create.mock.calls[1]
    );
    expect(db.rows(s.payments)).toHaveLength(1);
    boundary.retrieve.mockResolvedValue(
      session(boundary.create.mock.calls[1][0])
    );
    await caller().checkout(input);
    expect(boundary.retrieve).toHaveBeenCalledWith("cs_test_mock");
    expect(boundary.create).toHaveBeenCalledTimes(2);
  });
  it("ne recrée jamais une réservation ambiguë expirée ni avec une autre identité", async () => {
    boundary.create.mockRejectedValue(new Error("ambiguous"));
    await expect(caller().checkout(input)).rejects.toThrow("réservation");
    await expect(caller(user(2)).checkout(input)).rejects.toThrow("contexte");
    expect(boundary.create).toHaveBeenCalledTimes(1);
    db.rows(s.payments)[0].expiresAt = new Date(0);
    await expect(caller().checkout(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.rows(s.payments)).toHaveLength(1);
  });
  it("un succès test ne paie pas la facture et ne bloque pas un futur paiement live", async () => {
    db.put(s.payments, [payment({ status: "succeeded" })]);
    await expect(caller().checkout(input)).rejects.toThrow("test réussi");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    boundary.create.mockImplementation(async params =>
      session(params, {
        livemode: true,
        id: "cs_live_mock",
        payment_intent: "pi_live",
      })
    );
    expect((await caller().checkout(input)).mode).toBe("live");
    expect(db.rows(s.payments)).toHaveLength(2);
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it("ne réutilise pas une session complète ou une facture changée comme nouvelle charge", async () => {
    await caller().checkout(input);
    const params = boundary.create.mock.calls[0][0];
    boundary.retrieve.mockResolvedValue(
      session(params, { status: "complete", payment_status: "paid", url: null })
    );
    await expect(caller().checkout(input)).rejects.toThrow("vérification");
    expect(boundary.create).toHaveBeenCalledTimes(1);
    db.rows(s.invoices)[0].amountCents = 15000;
    await expect(caller().checkout(input)).rejects.toThrow("facture a changé");
    expect(boundary.create).toHaveBeenCalledTimes(1);
  });
  it("retourne strictement URL/mode et renouvelle seulement une session explicitement expirée chez Stripe", async () => {
    expect(await caller().checkout(input)).toEqual({
      url: "https://checkout.stripe.com/c/pay/mock",
      mode: "test",
    });
    const params = boundary.create.mock.calls[0][0];
    boundary.retrieve.mockResolvedValue(
      session(params, { status: "expired", url: null })
    );
    await expect(caller().checkout(input)).rejects.toThrow("expiré");
    expect(db.rows(s.payments)[0].status).toBe("expired");
    boundary.create.mockImplementation(async next =>
      session(next, { id: "cs_test_second", payment_intent: "pi_second" })
    );
    await caller().checkout(input);
    expect(db.rows(s.payments)).toHaveLength(2);
    expect(boundary.create.mock.calls[0][1].idempotencyKey).not.toBe(
      boundary.create.mock.calls[1][1].idempotencyKey
    );
  });
});

describe("webhook signé, exact et dédupliqué", () => {
  beforeEach(() => db.put(s.payments, [payment()]));
  it("succès test reste ledger uniquement ; redirection/annulation ne possède aucune mutation paid", async () => {
    expect(await processPaymentEvent(signedEvent(), "test")).toMatchObject({
      outcome: "test_succeeded_no_fulfillment",
    });
    expect(db.rows(s.payments)[0]).toMatchObject({
      status: "succeeded",
      paymentIntentId: "pi_mock",
    });
    expect(db.rows(s.invoices)[0].paidAt).toBeNull();
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "invoiced",
      version: 4,
    });
    expect(db.rows(s.events)).toHaveLength(0);
    expect(db.rows(s.notifications)).toHaveLength(0);
  });
  it("live exact acquitte facture/dossier, journal et deux notifications dans une seule transaction", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    expect(
      await processPaymentEvent(
        signedEvent("evt_live", undefined, {}, true),
        "live"
      )
    ).toMatchObject({ outcome: "live_fulfilled" });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "paid",
      version: 5,
    });
    expect(db.rows(s.invoices)[0].paidAt).toBeInstanceOf(Date);
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.notifications)).toHaveLength(2);
    expect(db.rows(s.paymentEvents)).toHaveLength(1);
    expect(db.rows(s.audit)[0].action).toBe("payment.live.fulfilled");
  });
  it("déduplique durablement deux événements identiques concurrents et ne double jamais notifications", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    const ev = signedEvent("evt_live", undefined, {}, true);
    const result = await Promise.all([
      processPaymentEvent(ev, "live"),
      processPaymentEvent(ev, "live"),
    ]);
    expect(result.filter(r => r.duplicate)).toHaveLength(1);
    expect(db.rows(s.paymentEvents)).toHaveLength(1);
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.notifications)).toHaveLength(2);
    await processPaymentEvent(
      signedEvent(
        "evt_late_failure",
        "payment_intent.payment_failed",
        {},
        true
      ),
      "live"
    );
    expect(db.rows(s.payments)[0].status).toBe("succeeded");
    expect(db.rows(s.requests)[0].status).toBe("paid");
    expect(db.rows(s.notifications)).toHaveLength(2);
  });
  it.each([{ amount_received: 11000 }, { currency: "usd" }])(
    "retient une remise/devise incompatible au lieu d’acquitter : %o",
    async patch => {
      db.put(s.payments, [payment({ mode: "live" })]);
      expect(
        await processPaymentEvent(
          signedEvent("evt_wrong", undefined, patch, true),
          "live"
        )
      ).toMatchObject({ outcome: "withheld_amount_currency" });
      expect(db.rows(s.payments)[0].status).toBe("succeeded");
      expect(db.rows(s.invoices)[0].paidAt).toBeNull();
      expect(db.rows(s.requests)[0].status).toBe("invoiced");
      expect(db.rows(s.notifications)).toHaveLength(1);
      expect(db.rows(s.events)).toHaveLength(0);
    }
  );
  it.each([{ status: "cancelled" }, { status: "paid" }])(
    "un paiement reçu après changement du dossier exige un rapprochement : %o",
    async patch => {
      db.put(s.payments, [payment({ mode: "live" })]);
      db.put(s.requests, [request(1, patch)]);
      expect(
        await processPaymentEvent(
          signedEvent("evt_changed", undefined, {}, true),
          "live"
        )
      ).toMatchObject({ outcome: "withheld_request_state" });
      expect(db.rows(s.requests)[0].status).toBe(patch.status);
      expect(db.rows(s.invoices)[0].paidAt).toBeNull();
      expect(db.rows(s.notifications)).toHaveLength(1);
    }
  );
  it("rejette mode/key, métadonnées falsifiées, identifiants divergents et facture legacy", async () => {
    expect(await processPaymentEvent(signedEvent(), "live")).toMatchObject({
      outcome: "rejected_mode",
    });
    expect(db.rows(s.payments)[0].status).toBe("pending");
    expect(
      await processPaymentEvent(
        signedEvent("evt_bad_link", undefined, {
          metadata: {
            payment_id: "1",
            request_id: "2",
            invoice_id: "1",
            checkout_key: "test-durable-payment-key",
          },
        }),
        "test"
      )
    ).toMatchObject({ outcome: "rejected_linkage" });
    db.rows(s.payments)[0].paymentIntentId = "pi_different";
    expect(
      await processPaymentEvent(signedEvent("evt_bad_id"), "test")
    ).toMatchObject({ outcome: "rejected_provider_id" });
    db.rows(s.payments)[0].paymentIntentId = null;
    db.rows(s.invoices)[0].amountCents = null;
    expect(
      await processPaymentEvent(signedEvent("evt_legacy"), "test")
    ).toMatchObject({ outcome: "withheld_invoice_changed" });
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it("checkout signé peut arriver AVANT la persistance du sessionID et le second intent ne double pas fulfillment", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    const ev: any = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      livemode: true,
      data: {
        object: session(
          {
            expires_at: 9999999999,
            client_reference_id: input.reference,
            metadata: signedEvent().data.object.metadata,
          },
          { livemode: true, status: "complete", payment_status: "paid" }
        ),
      },
    };
    expect(await processPaymentEvent(ev, "live")).toMatchObject({
      outcome: "live_fulfilled",
    });
    expect(db.rows(s.payments)[0].checkoutSessionId).toBe("cs_test_mock");
    expect(
      await processPaymentEvent(
        signedEvent("evt_intent", undefined, {}, true),
        "live"
      )
    ).toMatchObject({ outcome: "already_succeeded" });
    expect(db.rows(s.events)).toHaveLength(1);
    expect(db.rows(s.notifications)).toHaveLength(2);
  });
  it("une session unpaid ne remplit pas le dossier et une remise sur la session paid est retenue", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    const build = (id: string, patch: Row) =>
      ({
        id,
        type: "checkout.session.completed",
        livemode: true,
        data: {
          object: session(
            {
              expires_at: 9999999999,
              client_reference_id: input.reference,
              metadata: signedEvent().data.object.metadata,
            },
            { livemode: true, status: "complete", ...patch }
          ),
        },
      }) as any;
    expect(
      (await processPaymentEvent(build("evt_unpaid", {}), "live")).outcome
    ).toBe("awaiting_payment");
    expect(db.rows(s.payments)[0].status).toBe("pending");
    expect(
      (
        await processPaymentEvent(
          build("evt_discount", {
            payment_status: "paid",
            amount_total: 10000,
          }),
          "live"
        )
      ).outcome
    ).toBe("withheld_amount_currency");
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
    expect(db.rows(s.notifications)).toHaveLength(1);
  });
  it("rejette un identifiant fournisseur déjà lié à un autre paiement", async () => {
    db.put(s.payments, [
      payment(),
      payment({ id: 2, paymentIntentId: "pi_mock", reference: "MDS-P-other" }),
    ]);
    expect((await processPaymentEvent(signedEvent(), "test")).outcome).toBe(
      "rejected_provider_id_reused"
    );
    expect(db.rows(s.payments)[0].status).toBe("pending");
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
  });
  it("une seconde preuve de succès divergente ne disparaît pas dans la déduplication de paiement", async () => {
    await processPaymentEvent(signedEvent(), "test");
    expect(
      (
        await processPaymentEvent(
          signedEvent("evt_late_wrong", undefined, { amount_received: 100 }),
          "test"
        )
      ).outcome
    ).toBe("rejected_succeeded_amount");
    expect(db.rows(s.paymentEvents)).toHaveLength(2);
    expect(db.rows(s.payments)[0].status).toBe("succeeded");
  });
  it("paiement échoué ne change pas la facture ; un succès ultérieur reste possible", async () => {
    await processPaymentEvent(
      signedEvent("evt_failed", "payment_intent.payment_failed"),
      "test"
    );
    expect(db.rows(s.payments)[0].status).toBe("failed");
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
    await processPaymentEvent(signedEvent(), "test");
    expect(db.rows(s.payments)[0].status).toBe("succeeded");
  });
  it("acknowledge les abonnements inutilisés et événements signés étrangers sans données brutes", async () => {
    for (const type of [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ])
      expect(
        (
          await processPaymentEvent(
            {
              id: `evt_${type}`,
              type,
              livemode: false,
              data: { object: {} },
            } as any,
            "test"
          )
        ).outcome
      ).toBe("ignored_subscription");
    expect(
      (
        await processPaymentEvent(
          signedEvent("evt_foreign", undefined, { metadata: {} }),
          "test"
        )
      ).outcome
    ).toBe("ignored_unrelated");
    expect(db.rows(s.paymentEvents)).toHaveLength(4);
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
    expect(db.rows(s.paymentEvents)[0]).not.toHaveProperty("data");
  });
  it("une panne transactionnelle rollback également eventId/paid/audit/notifications et autorise une livraison ultérieure", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    const insert = db.builders.bind(db);
    let fail = true;
    const spy = vi.spyOn(db, "builders").mockImplementation(acquire => {
      const tx = insert(acquire);
      const original = tx.insert;
      tx.insert = table => {
        if (getTableName(table) === "mds_notifications" && fail)
          throw new Error("notification persistence unavailable");
        return original(table);
      };
      return tx;
    });
    const ev = signedEvent("evt_retry", undefined, {}, true);
    await expect(processPaymentEvent(ev, "live")).rejects.toThrow();
    expect(db.rows(s.paymentEvents)).toHaveLength(0);
    expect(db.rows(s.requests)[0].status).toBe("invoiced");
    expect(db.rows(s.payments)[0].status).toBe("pending");
    fail = false;
    await processPaymentEvent(ev, "live");
    expect(db.rows(s.requests)[0].status).toBe("paid");
    spy.mockRestore();
  });
  it("vérifie les vraies signatures Stripe sur les octets HTTP bruts AVANT express.json ; unsigned = 400 sans écritures", async () => {
    const actual = await vi.importActual<typeof import("stripe")>("stripe");
    const stripe = new actual.default("sk_test_no_network");
    boundary.verify.mockImplementation((...args: any[]) =>
      (stripe.webhooks.constructEvent as any)(...args)
    );
    const app = express();
    registerPaymentWebhook(app);
    app.use(express.json());
    const server = await new Promise<Server>(resolve => {
      const http = app.listen(0, "127.0.0.1", () => resolve(http));
    });
    servers.push(server);
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}/api/stripe/webhook`;
    const payload = JSON.stringify(signedEvent());
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_unit_test",
    });
    const bad = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(bad.status).toBe(400);
    expect(db.rows(s.paymentEvents)).toHaveLength(0);
    const tampered = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      body: payload + " ",
    });
    expect(tampered.status).toBe(400);
    expect(db.rows(s.paymentEvents)).toHaveLength(0);
    const valid = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      body: payload,
    });
    expect(valid.status).toBe(200);
    expect(db.rows(s.payments)[0].status).toBe("succeeded");
    expect(Buffer.isBuffer(boundary.verify.mock.calls.at(-1)![0])).toBe(true);
    expect(db.rows(s.paymentEvents)).toHaveLength(1);
  });
});

function fixedContract(patch: Row = {}) {
  return request(1, {
    status: "awaiting_client",
    quoteStatus: "none",
    proposedPriceCents: 12000,
    expiresAt: new Date(Date.now() + 3600000),
    pricingSnapshot: { pricingMode: "fixed", totalCents: 12000 },
    ...patch,
  });
}
function paymentPlan(patch: Row = {}) {
  return {
    id: 1,
    requestId: 1,
    version: 0,
    totalCents: 12000,
    depositCents: 3000,
    conditions: "Acompte avant intervention, solde sur facture.",
    status: "accepted",
    acceptedAt: new Date(),
    ...patch,
  };
}
function creditedPayment(patch: Row = {}) {
  return payment({
    mode: "live",
    status: "succeeded",
    receivedAmountCents: 12000,
    creditedAt: new Date(),
    confirmedAt: new Date(),
    paymentIntentId: "pi_mock",
    ...patch,
  });
}
function refundProof(patch: Row = {}) {
  return {
    object: "refund",
    id: "re_mock",
    payment_intent: "pi_mock",
    amount: 2000,
    currency: "eur",
    status: "succeeded",
    ...patch,
  };
}
function refundInput(patch: Row = {}) {
  return {
    paymentId: 1,
    amountCents: 2000,
    mode: "test" as const,
    reference: "MDS-P-test",
    reason: "Annulation validée par le client",
    confirm: true as const,
    idempotencyKey: "refund-unit-confirmation-123",
    ...patch,
  };
}
function refundRow(patch: Row = {}) {
  return {
    id: 1,
    paymentId: 1,
    amountCents: 2000,
    currency: "EUR",
    mode: "live",
    status: "succeeded",
    providerRefundId: "re_mock",
    idempotencyKey: "refund-history-key",
    reason: "Annulation client",
    requestedBy: 1,
    confirmedAt: new Date(),
    createdAt: new Date(),
    ...patch,
  };
}
function mockRefunds(live = false) {
  boundary.intentRetrieve.mockResolvedValue({
    object: "payment_intent",
    id: "pi_mock",
    status: "succeeded",
    livemode: live,
    currency: "eur",
    amount_received: 12000,
  });
  boundary.refundCreate.mockResolvedValue(refundProof());
  boundary.refundRetrieve.mockResolvedValue(refundProof());
}
describe("échéanciers et comptabilité commerciale vérifiée", () => {
  it("ne compte jamais les montants réservés, legacy, test, retenus ou devise invalide", async () => {
    db.put(s.payments, [
      creditedPayment({ amountCents: 10000, receivedAmountCents: 15000 }),
      creditedPayment({ id: 2, mode: "test" }),
      creditedPayment({ id: 3, creditedAt: null }),
      creditedPayment({ id: 4, receivedAmountCents: null }),
      creditedPayment({ id: 5, currency: "USD" }),
      creditedPayment({ id: 6, status: "pending" }),
      creditedPayment({
        id: 7,
        provider: "manual",
        mode: "offline",
        receivedAmountCents: 1000,
      }),
    ]);
    db.put(s.refunds, [
      refundRow({ amountCents: 2000 }),
      refundRow({ id: 2, status: "pending", amountCents: 3000 }),
      refundRow({ id: 3, mode: "test", amountCents: 4000 }),
    ]);
    expect(await commercialPaidCents(db as any, 1)).toBe(14000);
  });
  it("propose le total serveur avec seulement les suppléments acceptés terminés", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.invoices, []);
    db.put(s.extraWorks, [
      {
        id: 1,
        requestId: 1,
        status: "completed",
        acceptedAt: new Date(),
        completedAt: new Date(),
        amountCents: 2000,
      },
      { id: 2, requestId: 1, status: "pending", amountCents: 8000 },
    ]);
    await caller(user(1, "admin")).proposePlan({
      requestId: 1,
      version: 4,
      depositCents: 3000,
      conditions: "Acompte puis solde à la facture",
    });
    expect(db.rows(s.paymentPlans)[0]).toMatchObject({
      totalCents: 14000,
      status: "proposed",
      version: 0,
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "awaiting_client",
      version: 5,
      proposedPriceCents: 12000,
    });
  });
  it("refuse un échéancier avant approbation MDS et refuse de changer les fonds actifs", async () => {
    const propose = {
      requestId: 1,
      version: 4,
      depositCents: 3000,
      conditions: "Acompte puis solde à la facture",
    };
    db.put(s.requests, [fixedContract({ status: "awaiting_mds" })]);
    await expect(caller(user(1, "admin")).proposePlan(propose)).rejects.toThrow(
      "accord MDS"
    );
    db.put(s.requests, [fixedContract()]);
    db.put(s.payments, [payment({ mode: "live" })]);
    await expect(caller(user(1, "admin")).proposePlan(propose)).rejects.toThrow(
      "réservation"
    );
  });
  it("l’accord d’échéancier appartient au client, ne confirme ni RDV ni prix, et exige version actuelle", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.paymentPlans, [
      paymentPlan({ status: "proposed", acceptedAt: null }),
    ]);
    const consent = {
      reference: input.reference,
      token,
      id: 1,
      version: 0,
      accept: true,
    };
    await expect(
      caller(user(1, "admin")).respondPlan(consent)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().respondPlan({ ...consent, version: 1 })
    ).rejects.toThrow("actuelle");
    await caller().respondPlan(consent);
    expect(db.rows(s.paymentPlans)[0]).toMatchObject({
      status: "accepted",
      version: 1,
    });
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "awaiting_client",
      version: 4,
      proposedPriceCents: 12000,
    });
    expect(db.rows(s.appointments)).toHaveLength(0);
    await expect(caller().respondPlan(consent)).rejects.toThrow("actuelle");
  });
  it("l’acompte exige le plan accepté actuel et aucun contrat expiré", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.invoices, []);
    db.put(s.paymentPlans, [paymentPlan({ status: "proposed" })]);
    await expect(
      caller().checkout({ ...input, purpose: "deposit" })
    ).rejects.toThrow("accepté");
    db.put(s.paymentPlans, [paymentPlan()]);
    db.put(s.requests, [fixedContract({ expiresAt: new Date(0) })]);
    await expect(
      caller().checkout({ ...input, purpose: "deposit" })
    ).rejects.toThrow("valides");
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("crée un acompte avant facture avec lien plan stable et montant non envoyé par le client", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.invoices, []);
    db.put(s.paymentPlans, [paymentPlan()]);
    await caller().checkout({ ...input, purpose: "deposit" });
    expect(db.rows(s.payments)[0]).toMatchObject({
      invoiceId: null,
      planId: 1,
      purpose: "deposit",
      amountCents: 3000,
    });
    expect(boundary.create.mock.calls[0][0]).toMatchObject({
      metadata: { invoice_id: "", plan_id: "1", purpose: "deposit" },
    });
    expect(
      boundary.create.mock.calls[0][0].line_items[0].price_data.unit_amount
    ).toBe(3000);
  });
  it("l’acompte live impute réellement sans acquitter la facture ni confirmer le rendez-vous", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.invoices, []);
    db.put(s.paymentPlans, [paymentPlan()]);
    db.put(s.payments, [
      payment({
        mode: "live",
        invoiceId: null,
        purpose: "deposit",
        planId: 1,
        amountCents: 3000,
      }),
    ]);
    const ev = signedEvent(
      "evt_deposit",
      undefined,
      {
        amount_received: 3000,
        amount: 3000,
        metadata: {
          payment_id: "1",
          request_id: "1",
          invoice_id: "",
          plan_id: "1",
          purpose: "deposit",
          checkout_key: "test-durable-payment-key",
        },
      },
      true
    );
    expect((await processPaymentEvent(ev, "live")).outcome).toBe(
      "live_deposit_received"
    );
    expect(db.rows(s.payments)[0].creditedAt).toBeInstanceOf(Date);
    expect(await commercialPaidCents(db as any, 1)).toBe(3000);
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "awaiting_client",
      version: 4,
    });
    expect(db.rows(s.invoices)).toHaveLength(0);
    expect(db.rows(s.appointments)).toHaveLength(0);
    expect(db.rows(s.events)[0].status).toBe("awaiting_client");
  });
  it("l’acompte test ne réduit pas le solde commercial et ne crédite pas le dossier", async () => {
    db.put(s.requests, [fixedContract()]);
    db.put(s.invoices, []);
    db.put(s.paymentPlans, [paymentPlan()]);
    db.put(s.payments, [
      payment({
        invoiceId: null,
        purpose: "deposit",
        planId: 1,
        amountCents: 3000,
      }),
    ]);
    const ev = signedEvent("evt_deposit_test", undefined, {
      amount_received: 3000,
      metadata: {
        payment_id: "1",
        request_id: "1",
        invoice_id: "",
        plan_id: "1",
        purpose: "deposit",
        checkout_key: "test-durable-payment-key",
      },
    });
    expect((await processPaymentEvent(ev, "test")).outcome).toBe(
      "test_succeeded_no_fulfillment"
    );
    expect(await commercialPaidCents(db as any, 1)).toBe(0);
    expect(db.rows(s.payments)[0].creditedAt).toBeNull();
    expect((await caller().plan(input)).remainingCents).toBe(12000);
  });
  it("un solde ne débite que la facture moins les crédits réels et remboursements confirmés", async () => {
    db.put(s.payments, [
      creditedPayment({
        purpose: "deposit",
        planId: 1,
        invoiceId: null,
        amountCents: 3000,
        receivedAmountCents: 3000,
      }),
    ]);
    db.put(s.refunds, [refundRow({ amountCents: 1000 })]);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    boundary.create.mockImplementation(async params =>
      session(params, {
        livemode: true,
        id: "cs_balance",
        payment_intent: "pi_balance",
      })
    );
    await caller().checkout({ ...input, purpose: "balance" });
    expect(
      boundary.create.mock.calls[0][0].line_items[0].price_data.unit_amount
    ).toBe(10000);
  });
  it("un solde live exact acquitte uniquement le restant confirmé", async () => {
    db.put(s.payments, [
      creditedPayment({
        id: 2,
        purpose: "deposit",
        amountCents: 3000,
        receivedAmountCents: 3000,
        paymentIntentId: "pi_deposit",
      }),
      payment({ mode: "live", purpose: "balance", amountCents: 9000 }),
    ]);
    const ev = signedEvent(
      "evt_balance",
      undefined,
      {
        amount_received: 9000,
        amount: 9000,
        metadata: {
          payment_id: "1",
          request_id: "1",
          invoice_id: "1",
          purpose: "balance",
          checkout_key: "test-durable-payment-key",
        },
      },
      true
    );
    expect((await processPaymentEvent(ev, "live")).outcome).toBe(
      "live_fulfilled"
    );
    expect(await commercialPaidCents(db as any, 1)).toBe(12000);
    expect(db.rows(s.invoices)[0].paidAt).toBeInstanceOf(Date);
  });
  it("une tentative live pending ou failed d’une autre échéance interdit une seconde charge", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    for (const status of ["pending", "failed"]) {
      db.put(s.payments, [
        payment({
          mode: "live",
          purpose: "deposit",
          invoiceId: null,
          amountCents: 3000,
          status,
        }),
      ]);
      await expect(
        caller().checkout({ ...input, purpose: "balance" })
      ).rejects.toThrow("facture a changé");
    }
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("un succès retenu conserve reçu réel mais ne compte jamais commercialement et empêche un nouveau débit", async () => {
    db.put(s.payments, [payment({ mode: "live", amountCents: 10000 })]);
    await processPaymentEvent(
      signedEvent("evt_over", undefined, { amount_received: 15000 }, true),
      "live"
    );
    expect(db.rows(s.payments)[0]).toMatchObject({
      receivedAmountCents: 15000,
      creditedAt: null,
    });
    expect(await commercialPaidCents(db as any, 1)).toBe(0);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    await expect(caller().checkout(input)).rejects.toThrow("prise en compte");
    expect((await caller().list(input))[0]).toMatchObject({
      amountCents: 10000,
      receivedAmountCents: 15000,
      creditedAt: null,
    });
  });
});

describe("remboursements Stripe confirmés par relecture SDK", () => {
  beforeEach(() => {
    db.put(s.payments, [
      payment({
        status: "succeeded",
        paymentIntentId: "pi_mock",
        receivedAmountCents: 12000,
        confirmedAt: new Date(),
      }),
    ]);
    mockRefunds();
  });
  it("refuse les clients et exige checkbox, mode, montant, référence et motif explicites", async () => {
    await expect(caller(user(2)).refund(refundInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller(user(2, "admin")).refundable({ paymentId: 1 })
    ).resolves.toMatchObject({ paymentId: 1 });
    await expect(
      caller(user(1, "admin")).refund({
        ...refundInput(),
        confirm: false,
      } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(user(1, "admin")).refund(refundInput({ mode: "live" }))
    ).rejects.toThrow("exactement");
    await expect(
      caller(user(1, "admin")).refund(refundInput({ reference: "MDS-P-other" }))
    ).rejects.toThrow("exactement");
    expect(boundary.refundCreate).not.toHaveBeenCalled();
  });
  it("le plafond utilise les fonds provider réellement reçus, jamais le prix réservé 100 contre 150", async () => {
    db.put(s.payments, [
      payment({
        status: "succeeded",
        paymentIntentId: "pi_mock",
        amountCents: 10000,
        receivedAmountCents: 15000,
      }),
    ]);
    boundary.intentRetrieve.mockResolvedValue({
      object: "payment_intent",
      id: "pi_mock",
      status: "succeeded",
      livemode: false,
      currency: "eur",
      amount_received: 15000,
    });
    expect(
      await caller(user(1, "admin")).refundable({ paymentId: 1 })
    ).toMatchObject({
      remainingRefundableCents: 15000,
      reservedAmountCents: 10000,
      receivedAmountCents: 15000,
    });
    await expect(
      caller(user(1, "admin")).refund(refundInput({ amountCents: 15001 }))
    ).rejects.toThrow("fonds réellement");
    expect(boundary.refundCreate).not.toHaveBeenCalled();
  });
  it("réserve avant le réseau, re-lit le remboursement, et test ne change aucun acquittement commercial", async () => {
    db.put(s.invoices, [invoice({ paidAt: new Date() })]);
    db.put(s.requests, [request(1, { status: "paid" })]);
    boundary.refundCreate.mockImplementation(async () => {
      expect(db.rows(s.refunds)[0].status).toBe("pending");
      expect(db.rows(s.refunds)[0].confirmedAt == null).toBe(true);
      return refundProof();
    });
    const result = await caller(user(1, "admin")).refund(refundInput());
    expect(result).toMatchObject({
      status: "succeeded",
      mode: "test",
      amountCents: 2000,
    });
    expect(boundary.refundRetrieve).toHaveBeenCalledWith("re_mock");
    expect(db.rows(s.invoices)[0].paidAt).toBeInstanceOf(Date);
    expect(db.rows(s.requests)[0].status).toBe("paid");
  });
  it("pending ne vaut pas succès même si create affirme succeeded ; sync exige une vraie relecture", async () => {
    boundary.refundRetrieve.mockResolvedValue(
      refundProof({ status: "pending" })
    );
    expect((await caller(user(1, "admin")).refund(refundInput())).status).toBe(
      "pending"
    );
    expect(db.rows(s.refunds)[0].confirmedAt).toBeNull();
    boundary.refundRetrieve.mockResolvedValue(refundProof());
    expect((await caller(user(1, "admin")).syncRefund({ id: 1 })).status).toBe(
      "succeeded"
    );
    expect(boundary.refundCreate).toHaveBeenCalledTimes(1);
  });
  it("un timeout garde la même réservation et clé ; une autre clé reste bloquée", async () => {
    boundary.refundCreate.mockRejectedValueOnce(
      new Error("timeout after create")
    );
    const artisan = caller(user(1, "admin"));
    await expect(artisan.refund(refundInput())).rejects.toThrow(
      "clé sont conservées"
    );
    const key = db.rows(s.refunds)[0].idempotencyKey;
    await expect(
      artisan.refund(
        refundInput({ idempotencyKey: "other-refund-confirmation-123" })
      )
    ).rejects.toThrow("en attente");
    await artisan.refund(refundInput());
    expect(db.rows(s.refunds)).toHaveLength(1);
    expect(
      boundary.refundCreate.mock.calls.map(c => c[1].idempotencyKey)
    ).toEqual([key, key]);
    await artisan.refund(refundInput());
    expect(boundary.refundCreate).toHaveBeenCalledTimes(2);
  });
  it("deux confirmations simultanées ne créent qu’une réservation et une clé", async () => {
    const a = caller(user(1, "admin"));
    await Promise.all([a.refund(refundInput()), a.refund(refundInput())]);
    expect(db.rows(s.refunds)).toHaveLength(1);
    expect(
      new Set(boundary.refundCreate.mock.calls.map(c => c[1].idempotencyKey))
        .size
    ).toBe(1);
    expect(db.rows(s.events)).toHaveLength(1);
  });
  it.each([
    { payment_intent: "pi_other" },
    { currency: "usd" },
    { amount: 1999 },
  ])("ne confirme jamais une preuve divergente %o", async patch => {
    boundary.refundRetrieve.mockResolvedValue(refundProof(patch));
    await expect(
      caller(user(1, "admin")).refund(refundInput())
    ).rejects.toThrow("preuve Stripe");
    expect(db.rows(s.refunds)[0]).toMatchObject({
      status: "pending",
      providerRefundId: "re_mock",
    });
    expect(db.rows(s.events)).toHaveLength(0);
  });
  it("refuse une relecture mode intent divergent, puis peut resynchroniser sans nouvelle dépense", async () => {
    await caller(user(1, "admin")).refund(refundInput());
    boundary.intentRetrieve.mockResolvedValue({
      object: "payment_intent",
      id: "pi_mock",
      status: "succeeded",
      livemode: true,
      currency: "eur",
      amount_received: 12000,
    });
    await expect(
      caller(user(1, "admin")).syncRefund({ id: 1 })
    ).rejects.toThrow("preuve Stripe");
    expect(boundary.refundCreate).toHaveBeenCalledTimes(1);
  });
  it("un remboursement live confirmé enlève uniquement le crédit remboursé et rouvre financièrement une facture clôturée", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    mockRefunds(true);
    db.put(s.payments, [creditedPayment()]);
    db.put(s.invoices, [invoice({ paidAt: new Date() })]);
    db.put(s.requests, [request(1, { status: "closed" })]);
    await caller(user(1, "admin")).refund(refundInput({ mode: "live" }));
    expect(await commercialPaidCents(db as any, 1)).toBe(10000);
    expect(db.rows(s.invoices)[0].paidAt).toBeNull();
    expect(db.rows(s.requests)[0]).toMatchObject({
      status: "invoiced",
      version: 5,
    });
    expect(db.rows(s.events)[0].message).toContain(
      "Réouverture financière auditée"
    );
    await caller(user(1, "admin")).syncRefund({ id: 1 });
    expect(db.rows(s.requests)[0].version).toBe(5);
  });
  it("un remboursement d’un versement retenu ne révoque pas un règlement commercial indépendant", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit");
    mockRefunds(true);
    db.put(s.payments, [creditedPayment({ creditedAt: null })]);
    db.put(s.invoices, [invoice({ paidAt: new Date() })]);
    db.put(s.requests, [request(1, { status: "paid" })]);
    await caller(user(1, "admin")).refund(refundInput({ mode: "live" }));
    expect(db.rows(s.invoices)[0].paidAt).toBeInstanceOf(Date);
    expect(db.rows(s.requests)[0].status).toBe("paid");
  });
  it("la disponibilité est bornée par remboursements provider et réservations locales pending", async () => {
    db.put(s.refunds, [
      refundRow({
        mode: "test",
        status: "pending",
        confirmedAt: null,
        amountCents: 3000,
      }),
    ]);
    boundary.refundList.mockResolvedValue({
      data: [refundProof({ amount: 4000 })],
      has_more: false,
    });
    expect(
      (await caller(user(1, "admin")).refundable({ paymentId: 1 }))
        .remainingRefundableCents
    ).toBe(8000);
    boundary.refundList.mockResolvedValue({ data: [], has_more: true });
    await expect(
      caller(user(1, "admin")).refundable({ paymentId: 1 })
    ).rejects.toThrow("rapprochement");
  });
});

describe("rapprochement conservateur et contrat immuable", () => {
  it("un acompte sans facture reste imputable si la facture a été émise avant le webhook", async () => {
    db.put(s.requests, [fixedContract({ status: "invoiced" })]);
    db.put(s.paymentPlans, [paymentPlan()]);
    db.put(s.payments, [
      payment({
        mode: "live",
        invoiceId: null,
        purpose: "deposit",
        planId: 1,
        amountCents: 3000,
      }),
    ]);
    const ev = signedEvent(
      "evt_deposit_after_invoice",
      undefined,
      {
        amount_received: 3000,
        metadata: {
          payment_id: "1",
          request_id: "1",
          invoice_id: "",
          plan_id: "1",
          purpose: "deposit",
          checkout_key: "test-durable-payment-key",
        },
      },
      true
    );
    expect((await processPaymentEvent(ev, "live")).outcome).toBe(
      "live_deposit_received"
    );
    expect(db.rows(s.invoices)[0].paidAt).toBeNull();
    expect(await commercialPaidCents(db as any, 1)).toBe(3000);
  });
  it("un nouveau contrat modifié ne permet ni facture divergente ni acompte ancien", async () => {
    db.put(s.requests, [fixedContract({ status: "invoiced" })]);
    db.put(s.invoices, [invoice({ amountCents: 15000 })]);
    expect((await caller().plan(input)).invoicePayable).toBe(false);
    await expect(caller().checkout(input)).rejects.toThrow("contrat accepté");
    db.put(s.paymentPlans, [paymentPlan({ totalCents: 15000 })]);
    await expect(
      caller().checkout({ ...input, purpose: "deposit" })
    ).rejects.toThrow("contrat inchangé");
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("un devis accepté doit exister réellement avant une proposition d’acompte", async () => {
    db.put(s.requests, [
      request(1, {
        status: "awaiting_client",
        quoteStatus: "accepted",
        proposedPriceCents: 18000,
      }),
    ]);
    const proposal = {
      requestId: 1,
      version: 4,
      depositCents: 4500,
      conditions: "Acompte à la commande, solde à réception",
    };
    await expect(
      caller(user(1, "admin")).proposePlan(proposal)
    ).rejects.toThrow("divergent");
    db.put(s.quotes, [
      {
        id: 1,
        requestId: 1,
        status: "accepted",
        documentId: 1,
        acceptedAt: new Date(),
        amountCents: 18000,
      },
    ]);
    await caller(user(1, "admin")).proposePlan(proposal);
    expect(db.rows(s.paymentPlans)[0]).toMatchObject({
      totalCents: 18000,
      depositCents: 4500,
    });
  });
  it("un reçu à devise malformée n’expose pas un faux montant EUR et ne crédite pas le dossier", async () => {
    db.put(s.payments, [payment({ mode: "live" })]);
    await processPaymentEvent(
      signedEvent("evt_non_eur", undefined, { currency: "usd" }, true),
      "live"
    );
    expect(db.rows(s.payments)[0]).toMatchObject({
      status: "succeeded",
      receivedAmountCents: null,
      creditedAt: null,
    });
    expect(await commercialPaidCents(db as any, 1)).toBe(0);
  });
  it("la relecture malformée des fonds ne peut confirmer ni altérer un remboursement", async () => {
    db.put(s.payments, [
      payment({
        status: "succeeded",
        receivedAmountCents: 12000,
        paymentIntentId: "pi_mock",
      }),
    ]);
    mockRefunds();
    boundary.refundRetrieve.mockImplementation(async () => {
      boundary.intentRetrieve.mockResolvedValue({
        object: "payment_intent",
        id: "pi_mock",
        status: "succeeded",
        livemode: false,
        currency: "eur",
        amount_received: Number.NaN,
      });
      return refundProof();
    });
    await expect(
      caller(user(1, "admin")).refund(refundInput())
    ).rejects.toThrow("preuve Stripe");
    expect(db.rows(s.refunds)[0]).toMatchObject({
      status: "pending",
      providerRefundId: "re_mock",
    });
    expect(db.rows(s.payments)[0].receivedAmountCents).toBe(12000);
  });
  it("une réservation ambiguë après 23h ne renouvelle jamais la clé de débit", async () => {
    db.put(s.payments, [
      payment({
        status: "succeeded",
        receivedAmountCents: 12000,
        paymentIntentId: "pi_mock",
      }),
    ]);
    mockRefunds();
    boundary.refundCreate.mockRejectedValueOnce(
      new Error("ambiguous creation")
    );
    await expect(
      caller(user(1, "admin")).refund(refundInput())
    ).rejects.toThrow("conservées");
    db.rows(s.refunds)[0].createdAt = new Date(Date.now() - 24 * 3600000);
    await expect(
      caller(user(1, "admin")).refund(refundInput())
    ).rejects.toThrow("rapprochée");
    expect(boundary.refundCreate).toHaveBeenCalledTimes(1);
    expect(db.rows(s.refunds)).toHaveLength(1);
  });
});
