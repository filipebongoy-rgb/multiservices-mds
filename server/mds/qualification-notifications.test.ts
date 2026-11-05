import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import {
  manualQualification,
  validateQualification,
  qualificationAllowance,
} from "./qualification";
import {
  enqueueEventMessages,
  normalizeSmsPhone,
  deliverMessage,
  processOutbox,
  retrieveMessageStatus,
  safeOrigin,
  trackingMessageLink,
} from "./outbox";
const db = new MockDatabase();
function settings(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    artisanUserId: 1,
    trackingSecret: "a".repeat(64),
    publicOrigin: "https://mds.example.test",
    emailEnabled: true,
    smsEnabled: false,
    emailFrom: "mds@example.test",
    smsFrom: "",
    contactEmail: "artisan@example.test",
    contactPhone: "+33102030405",
    ...patch,
  } as typeof s.settings.$inferSelect;
}
function request(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    reference: "MDS-unit-test",
    idempotencyHash: "b".repeat(64),
    userId: null,
    organizationId: null,
    email: "client@example.test",
    phone: "+33601020304",
    proposedStart: null,
    ...patch,
  } as s.MdsRequest;
}
function message(patch: Record<string, unknown> = {}) {
  return {
    id: 1,
    requestId: 1,
    channel: "email",
    dedupeKey: "event:1:client:email",
    recipient: "client@example.test",
    subject: "MDS — demande",
    body: "Votre demande est reçue.",
    status: "queued",
    attempts: 0,
    nextAttemptAt: null,
    leaseUntil: null,
    providerId: null,
    createdAt: new Date(),
    ...patch,
  } as typeof s.messageOutbox.$inferSelect;
}
beforeEach(() => {
  db.clear();
  vi.stubEnv("MDS_RESEND_API_KEY", "unit-test-only-not-a-real-key");
  vi.stubEnv("MDS_TWILIO_ACCOUNT_SID", "AC" + "a".repeat(32));
  vi.stubEnv("MDS_TWILIO_AUTH_TOKEN", "unit-test-only-not-a-real-token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("qualification IA sans diagnostic ni réservation", () => {
  it("ne choisit jamais une prestation absente du catalogue actif", () => {
    expect(
      validateQualification(
        {
          serviceId: 99,
          trade: "plomberie",
          confidence: "probable",
          question: "Où fuit-il ?",
          missingInformation: [],
          summary: "Fuite",
        },
        [{ id: 1, trade: "plomberie" }],
        {}
      )
    ).toEqual(manualQualification());
  });
  it("une situation incertaine reste analysable par MDS", () => {
    const r = validateQualification(
      {
        serviceId: 1,
        trade: "plomberie",
        confidence: "uncertain",
        question: "Que voyez-vous ?",
        missingInformation: ["description"],
        summary: "Incertitude",
      },
      [{ id: 1, trade: "plomberie" }],
      {}
    );
    expect(r.serviceId).toBeNull();
    expect(r.question).toBe("Que voyez-vous ?");
    expect(r.confidence).toBe("uncertain");
  });
  it("aligne le métier sur la prestation validée et ne repose pas une question répondue", () => {
    const r = validateQualification(
      {
        serviceId: 1,
        trade: "electricite",
        confidence: "probable",
        question: "Où fuit-il ?",
        missingInformation: [],
        summary: "Fuite",
      },
      [{ id: 1, trade: "plomberie" }],
      { "Où fuit-il ?": "Robinet" }
    );
    expect(r.trade).toBe("plomberie");
    expect(r.question).toBeNull();
  });
  it.each([
    null,
    {},
    "diagnostic",
    { serviceId: -2 },
    ["question"],
    { confidence: "certain" },
  ])("un format invalide %j transmet à MDS", value => {
    expect(validateQualification(value, [], {})).toEqual(manualQualification());
  });
  it("borne les appels publics plutôt que de facturer une boucle", () => {
    const key = "unit-" + Math.random();
    for (let i = 0; i < 10; i++)
      expect(qualificationAllowance(key, 100)).toBe(true);
    expect(qualificationAllowance(key, 100)).toBe(false);
    expect(qualificationAllowance(key, 3600101)).toBe(true);
  });
});
describe("file externe durable et résultat réel", () => {
  it("déduplique un événement et n’envoie pas à l’auteur de sa propre action", async () => {
    const p = settings();
    for (let i = 0; i < 2; i++)
      await enqueueEventMessages(
        db as any,
        request(),
        p,
        1,
        "awaiting_client",
        "Votre accord est attendu.",
        "artisan"
      );
    expect(db.rows(s.messageOutbox)).toHaveLength(1);
    expect(db.rows(s.messageOutbox)[0]).toMatchObject({
      recipient: "client@example.test",
      status: "queued",
    });
  });
  it("désactivation ne prépare aucun envoi ancien pour une activation ultérieure", async () => {
    await enqueueEventMessages(
      db as any,
      request(),
      settings({ emailEnabled: false, smsEnabled: false }),
      1,
      "sent",
      "Demande reçue",
      "client"
    );
    expect(db.rows(s.messageOutbox)).toHaveLength(0);
  });
  it("pas de lien-capacité invité pour une organisation", () => {
    const link = trackingMessageLink(
      request({ organizationId: 7 }),
      settings()
    );
    expect(link).toBe("https://mds.example.test/suivi?ref=MDS-unit-test");
    expect(link).not.toContain("cle=");
  });
  it("les liens individuels portent une clé dans le fragment et une origine HTTPS explicite", () => {
    expect(trackingMessageLink(request(), settings())).toMatch(
      /#cle=[a-f0-9]{64}$/
    );
    expect(safeOrigin("https://a.example.test/path")).toBeNull();
    expect(safeOrigin("https://user:pass@a.example.test")).toBeNull();
    expect(safeOrigin("http://a.example.test")).toBeNull();
  });
  it("n’infère jamais le pays d’un numéro local", () => {
    expect(normalizeSmsPhone("06 01 02 03 04")).toBeNull();
    expect(normalizeSmsPhone("+33 6 01 02 03 04")).toBe("+33601020304");
  });
  it("une réponse Resend confirme l’acceptation, pas la livraison", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: "email-unit" }), { status: 200 })
        )
    );
    const r = await deliverMessage(message(), settings());
    expect(r).toEqual({ id: "email-unit", status: "accepted" });
  });
  it("un timeout ne relance pas un SMS potentiellement envoyé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    db.put(s.messageOutbox, [
      message({ channel: "sms", recipient: "+33601020304" }),
    ]);
    const r = await processOutbox(
      db as any,
      settings({
        emailEnabled: false,
        smsEnabled: true,
        smsFrom: "+33101010101",
      })
    );
    expect(r.messagesUncertain).toBe(1);
    expect(db.rows(s.messageOutbox)[0].status).toBe("uncertain");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("un worker interrompu est à vérifier, pas automatiquement réexpédié", async () => {
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    db.put(s.messageOutbox, [
      message({ status: "sending", leaseUntil: new Date(0) }),
    ]);
    await processOutbox(db as any, settings());
    expect(db.rows(s.messageOutbox)[0].status).toBe("uncertain");
    expect(send).not.toHaveBeenCalled();
  });
  it("deux traitements concurrents réclament une seule fois le message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ id: "email-unit" })))
    );
    db.put(s.messageOutbox, [message()]);
    await Promise.all([
      processOutbox(db as any, settings()),
      processOutbox(db as any, settings()),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.rows(s.messageOutbox)[0].status).toBe("accepted");
  });
  it("une erreur de configuration ne compte pas comme envoyé", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 }))
    );
    db.put(s.messageOutbox, [message()]);
    const r = await processOutbox(db as any, settings());
    expect(r.messagesAccepted).toBe(0);
    expect(db.rows(s.messageOutbox)[0].status).toBe("failed");
  });
  it("preuve de livraison exige identifiant et destinataire exacts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "email-unit",
            to: ["client@example.test"],
            last_event: "delivered",
          })
        )
      )
    );
    expect(
      (await retrieveMessageStatus(message({ providerId: "email-unit" })))
        .status
    ).toBe("delivered");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "other",
            to: ["client@example.test"],
            last_event: "delivered",
          })
        )
      )
    );
    await expect(
      retrieveMessageStatus(message({ providerId: "email-unit" }))
    ).rejects.toThrow("correspond");
  });
  it("un statut SMS queued reste accepté, pas livré", async () => {
    const sid = "SM" + "b".repeat(32);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ sid, to: "+33601020304", status: "queued" })
          )
        )
    );
    expect(
      (
        await retrieveMessageStatus(
          message({
            channel: "sms",
            providerId: sid,
            recipient: "+33601020304",
          })
        )
      ).status
    ).toBe("accepted");
  });
});

// Exact races reported by the read-only review; no provider or production database involved.
describe("claims de file liés à leur tentative", () => {
  function staleReads(
    snapshot: ReturnType<typeof message>,
    selectIndex: number
  ) {
    let count = 0;
    return new Proxy(db, {
      get(target, key) {
        if (key === "select")
          return (...args: any[]) => {
            const query = (target.select as any)(...args);
            count++;
            if (count === selectIndex)
              query.then = (resolve: any, reject: any) =>
                Promise.resolve([snapshot]).then(resolve, reject);
            return query;
          };
        const value = (target as any)[key];
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as any;
  }
  it("une désactivation lue avant un claim ne désactive pas un SMS déjà en vol", async () => {
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>(r => (entered = r)),
      gate = new Promise<void>(r => (release = r));
    const snapshot = message({ channel: "sms", recipient: "+33601020304" });
    db.put(s.messageOutbox, [snapshot]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        entered();
        await gate;
        return new Response(
          JSON.stringify({ sid: "SM" + "b".repeat(32), status: "queued" })
        );
      })
    );
    const enabled = settings({
      emailEnabled: false,
      smsEnabled: true,
      smsFrom: "+33101010101",
    });
    const first = processOutbox(db as any, enabled);
    await started;
    await processOutbox(
      staleReads(snapshot, 2),
      settings({ emailEnabled: false, smsEnabled: false })
    );
    expect(db.rows(s.messageOutbox)[0]).toMatchObject({
      status: "sending",
      attempts: 1,
    });
    await processOutbox(db as any, enabled);
    expect(fetch).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(db.rows(s.messageOutbox)[0].status).toBe("accepted");
  });
  it.each([true, false])(
    "la clôture d’une ancienne tentative (%s succès) n’écrase pas la suivante",
    async success => {
      let release!: () => void, entered!: () => void;
      const started = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      db.put(s.messageOutbox, [message()]);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          entered();
          await gate;
          return success
            ? new Response(JSON.stringify({ id: "old-provider-id" }))
            : new Response("{}", { status: 401 });
        })
      );
      const first = processOutbox(db as any, settings());
      await started;
      Object.assign(db.rows(s.messageOutbox)[0], {
        status: "sending",
        attempts: 2,
        providerId: "new-provider-id",
        leaseUntil: new Date(Date.now() + 60000),
      });
      release();
      await first;
      expect(db.rows(s.messageOutbox)[0]).toMatchObject({
        status: "sending",
        attempts: 2,
        providerId: "new-provider-id",
      });
    }
  );
  it("un snapshot de lease échue ne rend pas incertaine une nouvelle lease active", async () => {
    const old = message({
      status: "sending",
      attempts: 1,
      leaseUntil: new Date(0),
    });
    db.put(s.messageOutbox, [
      { ...old, attempts: 2, leaseUntil: new Date(Date.now() + 60000) },
    ]);
    const r = await processOutbox(staleReads(old, 1), settings());
    expect(r.messagesUncertain).toBe(0);
    expect(db.rows(s.messageOutbox)[0]).toMatchObject({
      status: "sending",
      attempts: 2,
    });
  });
});
