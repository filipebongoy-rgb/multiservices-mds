import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import type { RequestStatus } from "@shared/mds";

export type MdsOutputs = inferRouterOutputs<AppRouter>["mds"];
export type Service = MdsOutputs["catalog"]["list"][number];
export type RequestRecord = MdsOutputs["requests"]["list"][number];
export type PrivateDocument =
  MdsOutputs["requests"]["detail"]["documents"][number];
export type Appointment = MdsOutputs["appointments"]["list"][number];

export const activeRequestStatuses: RequestStatus[] = [
  "awaiting_mds",
  "to_analyze",
  "accepted_mds",
  "needs_information",
  "proposed_slot",
  "awaiting_client",
  "quote_pending",
  "quote_accepted",
  "quote_refused",
  "expired",
];
export const editableRequestStatuses: RequestStatus[] = [
  ...activeRequestStatuses,
];

export const dateInput = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
export const dayKey = (value: Date | string) =>
  new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
