import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import * as s from "../../drizzle/schema";

const VOICE_MODEL = "gpt-5-mini";
const MAX_SPEECH = 1200;

type TwilioForm = Record<string, string | undefined>;

function xml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] || character);
}

function twimlSay(text: string) {
  return `<Say language="fr-FR" voice="Polly.Lea">${xml(text)}</Say>`;
}

function gather(origin: string) {
  return `<Gather input="speech dtmf" action="${xml(`${origin}/api/voice/respond`)}" method="POST" speechTimeout="auto" language="fr-FR" timeout="5">`;
}

function configured() {
  return Boolean(
    process.env.MDS_TWILIO_ACCOUNT_SID &&
      process.env.MDS_TWILIO_AUTH_TOKEN &&
      process.env.MDS_TWILIO_VOICE_FROM
  );
}

async function publicOrigin() {
  if (process.env.MDS_PUBLIC_ORIGIN) return process.env.MDS_PUBLIC_ORIGIN.replace(/\/$/, "");
  const db = await getDb();
  if (!db) return "";
  const [row] = await db.select({ publicOrigin: s.settings.publicOrigin }).from(s.settings).where(eq(s.settings.id, 1)).limit(1);
  return row?.publicOrigin?.replace(/\/$/, "") || "";
}

function verifyTwilioSignature(req: Request, params: TwilioForm, origin: string) {
  const token = process.env.MDS_TWILIO_AUTH_TOKEN;
  const signature = req.get("X-Twilio-Signature");
  if (!token || !origin || !signature) return false;
  const url = `${origin}${req.originalUrl}`;
  const payload = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key] ?? ""}`)
    .join("");
  const expected = createHmac("sha1", token)
    .update(url + payload)
    .digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

function unavailable(res: Response) {
  res.type("text/xml").status(503).send(
    `<Response>${twimlSay("Le service téléphonique MDS n'est pas encore configuré. Merci de rappeler plus tard.")}<Hangup/></Response>`
  );
}

async function logCall(form: TwilioForm, status: "received" | "in_progress" | "completed" | "failed", patch: Record<string, unknown> = {}) {
  const db = await getDb();
  if (!db || !form.CallSid) return;
  const [existing] = await db.select({ id: s.voiceCallLogs.id }).from(s.voiceCallLogs).where(eq(s.voiceCallLogs.callSid, form.CallSid)).limit(1);
  if (existing) {
    await db.update(s.voiceCallLogs).set({ status, ...patch }).where(eq(s.voiceCallLogs.id, existing.id));
    return;
  }
  await db.insert(s.voiceCallLogs).values({
    callSid: form.CallSid,
    fromNumber: form.From || null,
    toNumber: form.To || null,
    direction: form.Direction === "outbound-api" ? "outbound" : "inbound",
    status,
    startedAt: new Date(),
    ...patch,
  });
}

async function answerFromSpeech(speech: string) {
  const bounded = speech.trim().slice(0, MAX_SPEECH);
  if (!bounded) return "Je n'ai pas bien entendu. Pouvez-vous répéter, s'il vous plaît ?";
  try {
    const completion = await invokeLLM({
      model: VOICE_MODEL,
      reasoning: { effort: "low" },
      max_completion_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "Tu es l'assistante téléphonique de MULTISERVICES MDS à Rennes. Réponds en français, avec une seule réponse courte, naturelle et polie. Tu peux recueillir le besoin, le nom, la ville, le téléphone et une préférence de créneau. Tu ne promets jamais un prix, une disponibilité, un délai, une intervention ni un remboursement. Tu ne donnes aucun diagnostic technique. Si une action MDS est nécessaire, dis qu'elle sera enregistrée et traitée selon les disponibilités. Maximum 45 mots.",
        },
        { role: "user", content: bounded },
      ],
      signal: AbortSignal.timeout(10000),
    });
    const content = completion.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim()
      ? content.trim().slice(0, 500)
      : "Merci. J'ai enregistré votre demande. MDS va vérifier les informations et vous recontacter.";
  } catch {
    return "Merci. J'ai enregistré votre demande. Un membre de MDS vous recontactera après vérification.";
  }
}

export function voiceProviderReadiness() {
  return {
    configured: configured(),
    provider: "Twilio Voice + IA MDS",
    note: configured()
      ? "Paramètres Voice présents ; l’origine publique MDS est vérifiée au lancement de l’appel."
      : "Identifiants ou numéro Voice manquants : aucun appel réel ne sera lancé.",
  };
}

export async function createOutboundVoiceCall(input: { to: string; requestId?: number }) {
  const sid = process.env.MDS_TWILIO_ACCOUNT_SID;
  const token = process.env.MDS_TWILIO_AUTH_TOKEN;
  const from = process.env.MDS_TWILIO_VOICE_FROM;
  const origin = await publicOrigin();
  if (!sid || !token || !from || !origin) throw new Error("Agent vocal MDS non configuré.");
  if (!/^\+[1-9]\d{7,14}$/.test(input.to)) throw new Error("Le numéro client doit être au format international.");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: input.to,
      From: from,
      Url: `${origin}/api/voice/outbound${input.requestId ? `?requestId=${input.requestId}` : ""}`,
      StatusCallback: `${origin}/api/voice/status`,
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: "initiated ringing answered completed",
    }),
  });
  if (!response.ok) throw new Error(`Twilio Voice a refusé l’appel (${response.status}).`);
  return (await response.json()) as { sid?: string; status?: string };
}

export function registerVoiceRoutes(app: Express) {
  app.post("/api/voice/incoming", async (req, res) => {
    const origin = await publicOrigin();
    if (!configured() || !origin) return unavailable(res);
    const form = req.body as TwilioForm;
    if (!verifyTwilioSignature(req, form, origin)) return res.status(401).send("Unauthorized");
    await logCall(form, "in_progress");
    res.type("text/xml").send(
      `<Response>${twimlSay("Bonjour, vous êtes en relation avec l'assistante MDS. Dites-moi simplement ce dont vous avez besoin.")}${gather(origin)}</Gather><Redirect method="POST">${xml(`${origin}/api/voice/incoming`)}</Redirect></Response>`
    );
  });

  app.post("/api/voice/respond", async (req, res) => {
    const origin = await publicOrigin();
    if (!configured() || !origin) return unavailable(res);
    const form = req.body as TwilioForm;
    if (!verifyTwilioSignature(req, form, origin)) return res.status(401).send("Unauthorized");
    const speech = (form.SpeechResult || "").trim();
    const reply = await answerFromSpeech(speech);
    await logCall(form, "in_progress", { transcript: speech || null });
    res.type("text/xml").send(
      `<Response>${twimlSay(reply)}${gather(origin)}</Gather><Redirect method="POST">${xml(`${origin}/api/voice/respond`)}</Redirect></Response>`
    );
  });

  app.post("/api/voice/outbound", async (req, res) => {
    const origin = await publicOrigin();
    if (!configured() || !origin) return unavailable(res);
    const form = req.body as TwilioForm;
    if (!verifyTwilioSignature(req, form, origin)) return res.status(401).send("Unauthorized");
    await logCall(form, "in_progress");
    res.type("text/xml").send(
      `<Response>${twimlSay("Bonjour, c'est l'assistante de MULTISERVICES MDS. Je vous appelle au sujet de votre demande. Comment puis-je vous aider ?")}${gather(origin)}</Gather></Response>`
    );
  });

  app.post("/api/voice/status", async (req, res) => {
    const origin = await publicOrigin();
    if (!configured() || !origin) return unavailable(res);
    const form = req.body as TwilioForm;
    if (!verifyTwilioSignature(req, form, origin)) return res.status(401).send("Unauthorized");
    const status = form.CallStatus === "completed" ? "completed" : ["failed", "busy", "no-answer", "canceled"].includes(form.CallStatus || "") ? "failed" : "in_progress";
    await logCall(form, status, { endedAt: status === "completed" || status === "failed" ? new Date() : null, lastError: status === "failed" ? form.ErrorMessage || form.CallStatus || "Appel non abouti" : null });
    return res.status(204).end();
  });
}
