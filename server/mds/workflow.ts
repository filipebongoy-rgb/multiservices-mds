import { TRPCError } from "@trpc/server";
import type { MdsRequest } from "../../drizzle/schema";
import type { RequestStatus } from "../../shared/mds";

export function fail(message: string, code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "UNAUTHORIZED" = "BAD_REQUEST"): never { throw new TRPCError({ code, message }); }
export const proposalStates: RequestStatus[] = ["accepted_mds", "proposed_slot", "awaiting_client", "quote_pending", "quote_accepted"];
export const analysisStates: RequestStatus[] = ["awaiting_mds", "to_analyze", "needs_information", "expired", "quote_refused"];
export const negotiableStates: RequestStatus[] = [...analysisStates, ...proposalStates];
export const finishedStates: RequestStatus[] = ["completed", "invoiced", "paid", "closed"];
export function requireState(request: Pick<MdsRequest, "status">, allowed: readonly RequestStatus[]) {
  if (!allowed.includes(request.status)) fail("Cette action n’est pas disponible dans l’état actuel de la demande.", "CONFLICT");
}
export function checkVersion(request: Pick<MdsRequest, "version">, version: number) {
  if (request.version !== version) fail("Le dossier a changé. Actualisez-le avant de continuer.", "CONFLICT");
}
export function isExpired(request: Pick<MdsRequest, "status" | "expiresAt">, now = new Date()) {
  return proposalStates.includes(request.status) && !!request.expiresAt && request.expiresAt.getTime() <= now.getTime();
}
export function requireMessage(message: string | undefined, label = "Précisez le motif de cette action.") {
  if (!message?.trim()) fail(label);
  return message.trim();
}
export function slot(start: Date | null, price: number | null, duration: number, now = new Date()) {
  if (!start || !Number.isFinite(start.getTime()) || start <= now) fail("Un créneau futur précis est obligatoire.");
  if (price === null || !Number.isSafeInteger(price) || price < 0) fail("Un prix explicite est obligatoire avant l’accord MDS.");
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440) fail("La durée doit être comprise entre 15 et 1440 minutes.");
  return { startAt: start, endAt: new Date(start.getTime() + duration * 60000) };
}
export function mayConfirm(request: Pick<MdsRequest, "status" | "quoteStatus">) {
  requireState(request, ["awaiting_client", "proposed_slot", "quote_accepted"]);
  if (request.quoteStatus !== "none" && request.quoteStatus !== "accepted") fail("Le devis doit être accepté séparément avant la confirmation.", "CONFLICT");
}
export function overlaps(a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }) {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}
export function safeAnswers(value: Record<string, string>) {
  if (Object.keys(value).length > 30 || Object.keys(value).some(k => k.length > 200 || ["__proto__", "prototype", "constructor"].includes(k))) fail("Les réponses aux questions sont invalides.");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 35000) fail("Les réponses sont trop volumineuses.");
  return value;
}
