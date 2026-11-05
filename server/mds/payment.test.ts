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
}));
vi.mock("../db", () => ({ getDb: async () => boundary.db }));
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: { create: boundary.create, retrieve: boundary.retrieve },
    };
    webhooks = { constructEvent: boundary.verify };
  },
}));
import {
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
