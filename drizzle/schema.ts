import type {
  WeeklyWindow,
  TravelZone,
  AlternativeSlot,
  QuoteContent,
} from "../shared/operations";
import type {
  PricingSnapshot,
  PricingRules,
  TravelRule,
} from "../shared/pricing";
import {
  int,
  date,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  address: varchar("address", { length: 500 }),
  postcode: varchar("postcode", { length: 12 }),
  city: varchar("city", { length: 120 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  localLoginKey: varchar("localLoginKey", { length: 180 }).unique(),
  accountType: mysqlEnum("accountType", ["particular", "professional"])
    .default("particular")
    .notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localCredentials = mysqlTable("mds_local_credentials", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id),
  passwordHash: varchar("passwordHash", { length: 128 }).notNull(),
  passwordSalt: varchar("passwordSalt", { length: 64 }).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const localSessions = mysqlTable(
  "mds_local_sessions",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  table => [index("local_sessions_user_idx").on(table.userId)]
);

export const localPasswordResets = mysqlTable(
  "mds_local_password_resets",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("local_password_resets_user_idx").on(table.userId)]
);
const dates = () => ({
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
const id = () => int("id").autoincrement().primaryKey();

export const adminInvites = mysqlTable("mds_admin_invites", {
  id: id(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "active", "revoked"])
    .default("active")
    .notNull(),
  invitedBy: int("invitedBy").references(() => users.id),
  acceptedBy: int("acceptedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),
  ...dates(),
});

export const artisanTeam = mysqlTable(
  "mds_artisan_team",
  {
    id: id(),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id),
    userId: int("userId").references(() => users.id),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("displayName", { length: 200 }).notNull(),
    role: mysqlEnum("role", ["technician", "assistant"]).default("technician").notNull(),
    status: mysqlEnum("status", ["pending", "active", "revoked"]).default("pending").notNull(),
    ...dates(),
  },
  table => [uniqueIndex("artisan_team_owner_email").on(table.ownerUserId, table.email)]
);

export const artisanAssignments = mysqlTable(
  "mds_artisan_assignments",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .references(() => requests.id),
    teamMemberId: int("teamMemberId")
      .notNull()
      .references(() => artisanTeam.id),
    assignedBy: int("assignedBy").references(() => users.id),
    status: mysqlEnum("status", ["assigned", "completed", "cancelled"]).default("assigned").notNull(),
    ...dates(),
  },
  table => [uniqueIndex("artisan_assignment_request").on(table.requestId)]
);

export const settings = mysqlTable("mds_settings", {
  id: int("id").primaryKey(),
  zone: varchar("zone", { length: 300 }).default("").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).default("").notNull(),
  contactPhone: varchar("contactPhone", { length: 30 }).default("").notNull(),
  businessAddress: varchar("businessAddress", { length: 500 })
    .default("")
    .notNull(),
  legalName: varchar("legalName", { length: 200 }).default("").notNull(),
  legalNotice: text("legalNotice").notNull(),
  proposalExpiryHours: int("proposalExpiryHours").default(72).notNull(),
  artisanUserId: int("artisanUserId").references(() => users.id),
  activationHash: varchar("activationHash", { length: 64 }),
  trackingSecret: varchar("trackingSecret", { length: 64 }),
  activationUsedAt: timestamp("activationUsedAt"),
  calendarEnabled: boolean("calendarEnabled").default(false).notNull(),
  calendarTimezone: varchar("calendarTimezone", { length: 80 })
    .default("Europe/Paris")
    .notNull(),
  weeklyWindows: json("weeklyWindows").$type<WeeklyWindow[]>(),
  travelZones: json("travelZones").$type<TravelZone[]>(),
  bufferMinutes: int("bufferMinutes").default(0).notNull(),
  horizonDays: int("horizonDays").default(90).notNull(),
  remindersEnabled: boolean("remindersEnabled").default(false).notNull(),
  reminderHours: int("reminderHours").default(24).notNull(),
  proposalReminderHours: int("proposalReminderHours").default(6).notNull(),
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  smsEnabled: boolean("smsEnabled").default(false).notNull(),
  publicOrigin: varchar("publicOrigin", { length: 1000 }).default("").notNull(),
  emailFrom: varchar("emailFrom", { length: 320 }).default("").notNull(),
  smsFrom: varchar("smsFrom", { length: 80 }).default("").notNull(),
  ...dates(),
});
export const seedVersions = mysqlTable("mds_seed_versions", {
  version: varchar("version", { length: 100 }).primaryKey(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
});
export const services = mysqlTable("mds_services", {
  id: id(),
  seedKey: varchar("seedKey", { length: 150 }).unique(),
  trade: mysqlEnum("trade", [
    "plomberie",
    "electricite",
    "chauffage",
    "peinture",
    "maintenance",
  ]).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  photoUrl: varchar("photoUrl", { length: 1000 }).default("").notNull(),
  priceCents: int("priceCents"),
  pricingRule: varchar("pricingRule", { length: 500 }).notNull(),
  durationMinutes: int("durationMinutes").default(60).notNull(),
  pricingMode: mysqlEnum("pricingMode", ["fixed", "quote"])
    .default("quote")
    .notNull(),
  pricingVersion: int("pricingVersion").default(0).notNull(),
  included: text("included"),
  excluded: text("excluded"),
  travelMode: mysqlEnum("travelMode", [
    "unconfigured",
    "included",
    "fixed",
    "postcode",
  ])
    .default("unconfigured")
    .notNull(),
  travelFeeCents: int("travelFeeCents"),
  travelRules: json("travelRules").$type<TravelRule[]>(),
  questions: json("questions").$type<string[]>().notNull(),
  problemTypes: json("problemTypes").$type<string[]>().notNull(),
  conditions: text("conditions").notNull(),
  zone: varchar("zone", { length: 300 }).default("").notNull(),
  active: boolean("active").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  ...dates(),
});
export const tariffs = mysqlTable("mds_tariffs", {
  id: id(),
  serviceId: int("serviceId")
    .notNull()
    .references(() => services.id),
  priceCents: int("priceCents"),
  rule: text("rule").notNull(),
  configuration: json("configuration").$type<PricingRules>(),
  validFrom: timestamp("validFrom").defaultNow().notNull(),
  validUntil: timestamp("validUntil"),
  ...dates(),
});
export const organizations = mysqlTable("mds_organizations", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", [
    "entreprise",
    "syndic",
    "bailleur",
    "gestionnaire",
    "association",
    "collectivite",
  ]).notNull(),
  ownerUserId: int("ownerUserId")
    .notNull()
    .references(() => users.id),
  ...dates(),
});
export const members = mysqlTable(
  "mds_members",
  {
    id: id(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    role: mysqlEnum("role", ["owner", "manager", "member"]).notNull(),
    ...dates(),
  },
  t => [uniqueIndex("member_org_user").on(t.organizationId, t.userId)]
);
export const invitations = mysqlTable("mds_invitations", {
  id: id(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["manager", "member"]).notNull(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  invitedBy: int("invitedBy")
    .notNull()
    .references(() => users.id),
  acceptedBy: int("acceptedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  ...dates(),
});
export const sites = mysqlTable("mds_sites", {
  id: id(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name", { length: 150 }).notNull(),
  address: varchar("address", { length: 250 }).notNull(),
  postcode: varchar("postcode", { length: 5 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  contactName: varchar("contactName", { length: 120 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 30 }).notNull(),
  ...dates(),
});
export const clients = mysqlTable("mds_clients", {
  id: id(),
  userId: int("userId").references(() => users.id),
  organizationId: int("organizationId").references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  ...dates(),
});
export const requests = mysqlTable(
  "mds_requests",
  {
    id: id(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    trackingHash: varchar("trackingHash", { length: 64 }).notNull(),
    idempotencyHash: varchar("idempotencyHash", { length: 64 })
      .notNull()
      .unique(),
    payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
    userId: int("userId").references(() => users.id),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id),
    serviceId: int("serviceId").references(() => services.id),
    serviceName: varchar("serviceName", { length: 120 }),
    description: text("description").notNull(),
    problemType: varchar("problemType", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    address: varchar("address", { length: 250 }).notNull(),
    postcode: varchar("postcode", { length: 5 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    desiredStart: timestamp("desiredStart"),
    organizationId: int("organizationId").references(() => organizations.id),
    siteId: int("siteId").references(() => sites.id),
    pricingSnapshot: json("pricingSnapshot").$type<PricingSnapshot>(),
    alternatives: json("alternatives").$type<AlternativeSlot[]>(),
    departedAt: timestamp("departedAt"),
    answers: json("answers").$type<Record<string, string>>().notNull(),
    consentAt: timestamp("consentAt").notNull(),
    status: mysqlEnum("status", [
      "draft",
      "sent",
      "awaiting_mds",
      "to_analyze",
      "accepted_mds",
      "proposed_slot",
      "needs_information",
      "awaiting_client",
      "confirmed",
      "refused",
      "cancelled",
      "planned",
      "en_route",
      "in_progress",
      "completed",
      "invoiced",
      "paid",
      "closed",
      "expired",
      "quote_pending",
      "quote_accepted",
      "quote_refused",
    ]).notNull(),
    version: int("version").default(0).notNull(),
    proposedStart: timestamp("proposedStart"),
    proposedPriceCents: int("proposedPriceCents"),
    durationMinutes: int("durationMinutes").default(60).notNull(),
    proposalMessage: text("proposalMessage"),
    expiresAt: timestamp("expiresAt"),
    quoteStatus: mysqlEnum("quoteStatus", [
      "none",
      "pending",
      "accepted",
      "refused",
    ])
      .default("none")
      .notNull(),
    lastAction: varchar("lastAction", { length: 40 }),
    lastActionVersion: int("lastActionVersion"),
    deletedAt: timestamp("deletedAt"),
    ...dates(),
  },
  t => [
    index("requests_org").on(t.organizationId),
    index("requests_user").on(t.userId),
    index("requests_status").on(t.status),
  ]
);
export type MdsRequest = typeof requests.$inferSelect;
export const waitlistEntries = mysqlTable(
  "mds_waitlist_entries",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .unique()
      .references(() => requests.id),
    reason: mysqlEnum("reason", ["no_slot", "client_preference", "capacity"])
      .notNull()
      .default("no_slot"),
    status: mysqlEnum("status", [
      "waiting",
      "contacted",
      "converted",
      "cancelled",
    ])
      .notNull()
      .default("waiting"),
    requestedStart: timestamp("requestedStart"),
    contactedAt: timestamp("contactedAt"),
    convertedAt: timestamp("convertedAt"),
    ...dates(),
  },
  t => [index("waitlist_status_created").on(t.status, t.createdAt)]
);
export const events = mysqlTable("mds_events", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  status: varchar("status", { length: 40 }).notNull(),
  message: text("message").notNull(),
  actorType: mysqlEnum("actorType", ["client", "artisan", "system"]).notNull(),
  actorUserId: int("actorUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const appointments = mysqlTable(
  "mds_appointments",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .unique()
      .references(() => requests.id),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt").notNull(),
    status: mysqlEnum("status", [
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ]).notNull(),
    travelMinutes: int("travelMinutes").default(0).notNull(),
    bufferMinutes: int("bufferMinutes").default(0).notNull(),
    ...dates(),
  },
  t => [index("appointments_start").on(t.startAt)]
);
export const interventions = mysqlTable("mds_interventions", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .unique()
    .references(() => requests.id),
  appointmentId: int("appointmentId")
    .notNull()
    .unique()
    .references(() => appointments.id),
  startedAt: timestamp("startedAt"),
  arrivedAt: timestamp("arrivedAt"),
  // Destination géocodée une seule fois au premier point GPS du trajet.
  destinationLatE6: int("destinationLatE6"),
  destinationLngE6: int("destinationLngE6"),
  approachNotifiedAt: timestamp("approachNotifiedAt"),
  completedAt: timestamp("completedAt"),
  summary: text("summary"),
  clientConfirmedAt: timestamp("clientConfirmedAt"),
  clientConfirmationMessage: text("clientConfirmationMessage"),
  clientSignedAt: timestamp("clientSignedAt"),
  clientSignatureDocumentId: int("clientSignatureDocumentId").references(
    () => documents.id
  ),
  ...dates(),
});
export const availability = mysqlTable("mds_availability", {
  id: id(),
  artisanUserId: int("artisanUserId")
    .notNull()
    .references(() => users.id),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  kind: mysqlEnum("kind", ["available", "blocked"]).notNull(),
  note: text("note"),
  ...dates(),
});
export const documents = mysqlTable("mds_documents", {
  id: id(),
  requestId: int("requestId").references(() => requests.id),
  organizationId: int("organizationId").references(() => organizations.id),
  uploadedBy: int("uploadedBy").references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  kind: mysqlEnum("kind", [
    "photo",
    "quote",
    "invoice",
    "contract",
    "other",
    "signature",
  ]).notNull(),
  photoStage: mysqlEnum("photoStage", ["before", "after", "other"])
    .default("other")
    .notNull(),
  photoAuthor: mysqlEnum("photoAuthor", ["client", "artisan", "other"])
    .default("other")
    .notNull(),
  description: varchar("description", { length: 500 }),
  byteSize: int("byteSize").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  encryptionKey: varchar("encryptionKey", { length: 64 }).notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("authTag", { length: 32 }).notNull(),
  ...dates(),
});
export const quotes = mysqlTable("mds_quotes", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  documentId: int("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  status: mysqlEnum("status", [
    "pending",
    "accepted",
    "refused",
    "superseded",
  ]).notNull(),
  acceptedAt: timestamp("acceptedAt"),
  content: json("content").$type<QuoteContent>(),
  amountCents: int("amountCents"),
  issuedAt: timestamp("issuedAt"),
  ...dates(),
});
export const contracts = mysqlTable("mds_contracts", {
  id: id(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id),
  documentId: int("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  name: varchar("name", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["indexed", "active", "ended"])
    .default("indexed")
    .notNull(),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  ...dates(),
});
export const invoices = mysqlTable("mds_invoices", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .unique()
    .references(() => requests.id),
  documentId: int("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  amountCents: int("amountCents"),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
  paymentVerifiedBy: int("paymentVerifiedBy").references(() => users.id),
  verificationNote: text("verificationNote"),
});
export const notifications = mysqlTable("mds_notifications", {
  id: id(),
  userId: int("userId").references(() => users.id),
  organizationId: int("organizationId").references(() => organizations.id),
  requestId: int("requestId").references(() => requests.id),
  audience: mysqlEnum("audience", ["artisan", "client"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const locationUpdates = mysqlTable(
  "mds_location_updates",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .references(() => requests.id),
    artisanUserId: int("artisanUserId")
      .notNull()
      .references(() => users.id),
    latitudeE6: int("latitudeE6").notNull(),
    longitudeE6: int("longitudeE6").notNull(),
    accuracyM: int("accuracyM"),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  t => [index("location_request_time").on(t.requestId, t.recordedAt)]
);
export const notificationReads = mysqlTable(
  "mds_notification_reads",
  {
    id: id(),
    notificationId: int("notificationId")
      .notNull()
      .references(() => notifications.id),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("notification_read_user").on(t.notificationId, t.userId)]
);
export const reviews = mysqlTable(
  "mds_reviews",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .references(() => requests.id),
    interventionId: int("interventionId")
      .notNull()
      .references(() => interventions.id),
    authorUserId: int("authorUserId")
      .notNull()
      .references(() => users.id),
    authorType: mysqlEnum("authorType", ["artisan", "client"]).notNull(),
    rating: int("rating").notNull(),
    comment: text("comment"),
    moderation: mysqlEnum("moderation", ["pending", "approved", "hidden"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("review_request_role").on(t.requestId, t.authorType)]
);
export const audit = mysqlTable("mds_audit", {
  id: id(),
  actorUserId: int("actorUserId").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const siteVisits = mysqlTable(
  "mds_site_visits",
  {
    id: id(),
    visitorHash: varchar("visitorHash", { length: 64 }).notNull(),
    visitDay: date("visitDay", { mode: "string" }).notNull(),
    path: varchar("path", { length: 120 }).notNull().default("/"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("site_visits_visitor_day").on(t.visitorHash, t.visitDay)]
);

export const payments = mysqlTable(
  "mds_payments",
  {
    id: id(),
    requestId: int("requestId")
      .notNull()
      .references(() => requests.id),
    invoiceId: int("invoiceId").references(() => invoices.id),
    planId: int("planId"),
    purpose: mysqlEnum("purpose", ["full", "deposit", "balance"])
      .default("full")
      .notNull(),
    receivedAmountCents: int("receivedAmountCents"),
    creditedAt: timestamp("creditedAt"),
    provider: mysqlEnum("provider", ["stripe", "manual"]).notNull(),
    mode: mysqlEnum("mode", ["test", "live", "offline"]).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "succeeded",
      "failed",
      "expired",
      "cancelled",
    ]).notNull(),
    amountCents: int("amountCents").notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    checkoutSessionId: varchar("checkoutSessionId", { length: 255 }).unique(),
    paymentIntentId: varchar("paymentIntentId", { length: 255 }).unique(),
    checkoutKey: varchar("checkoutKey", { length: 100 }).unique(),
    reference: varchar("reference", { length: 255 }),
    verifiedBy: int("verifiedBy").references(() => users.id),
    verificationNote: text("verificationNote"),
    expiresAt: timestamp("expiresAt"),
    confirmedAt: timestamp("confirmedAt"),
    failureReason: text("failureReason"),
    ...dates(),
  },
  t => [
    index("payments_request").on(t.requestId),
    index("payments_invoice").on(t.invoiceId),
  ]
);
export const paymentEvents = mysqlTable("mds_payment_events", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  provider: varchar("provider", { length: 30 }).notNull(),
  mode: mysqlEnum("mode", ["test", "live"]).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  paymentId: int("paymentId").references(() => payments.id),
  outcome: varchar("outcome", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export const quoteDrafts = mysqlTable("mds_quote_drafts", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  version: int("version").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "generated", "issued"])
    .default("draft")
    .notNull(),
  content: json("content").$type<QuoteContent>().notNull(),
  totalCents: int("totalCents").notNull(),
  documentId: int("documentId").references(() => documents.id),
  reference: varchar("reference", { length: 80 }).notNull().unique(),
  ...dates(),
});
export const incidents = mysqlTable("mds_incidents", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  kind: mysqlEnum("kind", [
    "problem",
    "no_slot",
    "client_absent",
    "artisan_unavailable",
    "complaint",
    "payment_failed",
  ]).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  reportedBy: int("reportedBy").references(() => users.id),
  actorType: mysqlEnum("actorType", ["artisan", "client", "system"]).notNull(),
  resolution: text("resolution"),
  resolvedBy: int("resolvedBy").references(() => users.id),
  resolvedAt: timestamp("resolvedAt"),
  ...dates(),
});
export const extraWorks = mysqlTable("mds_extra_works", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  scope: text("scope").notNull(),
  amountCents: int("amountCents").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  conditions: text("conditions").notNull(),
  documentId: int("documentId").references(() => documents.id),
  status: mysqlEnum("status", [
    "pending",
    "accepted",
    "refused",
    "cancelled",
    "in_progress",
    "completed",
  ])
    .default("pending")
    .notNull(),
  version: int("version").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  acceptedAt: timestamp("acceptedAt"),
  acceptedBy: int("acceptedBy").references(() => users.id),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  ...dates(),
});
export const paymentPlans = mysqlTable("mds_payment_plans", {
  id: id(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  version: int("version").default(0).notNull(),
  totalCents: int("totalCents").notNull(),
  depositCents: int("depositCents").notNull(),
  conditions: text("conditions").notNull(),
  status: mysqlEnum("status", ["proposed", "accepted", "refused", "cancelled"])
    .default("proposed")
    .notNull(),
  acceptedAt: timestamp("acceptedAt"),
  ...dates(),
});
export const refunds = mysqlTable("mds_refunds", {
  id: id(),
  paymentId: int("paymentId")
    .notNull()
    .references(() => payments.id),
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  mode: mysqlEnum("mode", ["test", "live"]).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "succeeded",
    "failed",
    "cancelled",
  ]).notNull(),
  providerRefundId: varchar("providerRefundId", { length: 255 }).unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  reason: text("reason").notNull(),
  requestedBy: int("requestedBy")
    .notNull()
    .references(() => users.id),
  confirmedAt: timestamp("confirmedAt"),
  ...dates(),
});
export const messageOutbox = mysqlTable("mds_message_outbox", {
  id: id(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  requestId: int("requestId").references(() => requests.id),
  userId: int("userId").references(() => users.id),
  organizationId: int("organizationId").references(() => organizations.id),
  channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", [
    "queued",
    "sending",
    "accepted",
    "delivered",
    "failed",
    "disabled",
    "uncertain",
    "cancelled",
  ]).notNull(),
  providerId: varchar("providerId", { length: 255 }),
  attempts: int("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  leaseUntil: timestamp("leaseUntil"),
  lastError: varchar("lastError", { length: 500 }),
  acceptedAt: timestamp("acceptedAt"),
  deliveredAt: timestamp("deliveredAt"),
  ...dates(),
});
export const assistantActions = mysqlTable("mds_assistant_actions", {
  id: id(),
  requestId: int("requestId").references(() => requests.id),
  createdBy: int("createdBy")
    .notNull()
    .references(() => users.id),
  actionType: mysqlEnum("actionType", [
    "follow_up",
    "quote_review",
    "invoice_review",
    "appointment_confirmation",
    "call_script",
  ]).notNull(),
  channel: mysqlEnum("channel", ["email", "sms", "call"]).notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", [
    "proposed",
    "approved",
    "sent",
    "failed",
    "cancelled",
    // Validated by the artisan, waiting for scheduledFor. Appended last so the
    // existing enum values keep their position in MySQL.
    "scheduled",
  ])
    .default("proposed")
    .notNull(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  lastError: varchar("lastError", { length: 500 }),
  scheduledFor: timestamp("scheduledFor"),
  approvedAt: timestamp("approvedAt"),
  completedAt: timestamp("completedAt"),
  ...dates(),
}, table => [
  index("assistant_actions_request").on(table.requestId),
  index("assistant_actions_status").on(table.status),
  index("assistant_actions_due").on(table.status, table.scheduledFor),
]);
export const voiceCallLogs = mysqlTable(
  "mds_voice_call_logs",
  {
    id: id(),
    callSid: varchar("callSid", { length: 120 }).notNull().unique(),
    fromNumber: varchar("fromNumber", { length: 30 }),
    toNumber: varchar("toNumber", { length: 30 }),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
    status: mysqlEnum("status", ["received", "in_progress", "completed", "failed"]).default("received").notNull(),
    requestId: int("requestId").references(() => requests.id),
    transcript: text("transcript"),
    summary: text("summary"),
    lastError: varchar("lastError", { length: 500 }),
    startedAt: timestamp("startedAt"),
    endedAt: timestamp("endedAt"),
    ...dates(),
  },
  table => [
    index("voice_call_logs_status").on(table.status),
    index("voice_call_logs_request").on(table.requestId),
  ]
);
export const reminders = mysqlTable("mds_reminders", {
  id: id(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  requestId: int("requestId")
    .notNull()
    .references(() => requests.id),
  kind: mysqlEnum("kind", ["proposal", "appointment"]).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  sentAt: timestamp("sentAt"),
  ...dates(),
});
export const automationTasks = mysqlTable("mds_automation_tasks", {
  id: int("id").primaryKey(),
  taskUid: varchar("taskUid", { length: 255 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  ...dates(),
});
export const automationRuns = mysqlTable("mds_automation_runs", {
  id: id(),
  runKey: varchar("runKey", { length: 180 }).notNull().unique(),
  taskUid: varchar("taskUid", { length: 255 }),
  source: mysqlEnum("source", ["scheduled", "manual"]).notNull(),
  status: mysqlEnum("status", ["running", "succeeded", "failed"]).notNull(),
  summary: json("summary").$type<Record<string, number>>(),
  error: varchar("error", { length: 500 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});
