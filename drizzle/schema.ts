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
  integer,
  serial,
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const usersAccountTypeEnum = pgEnum("users_accountType", [
  "particular",
  "professional",
]);
export const usersRoleEnum = pgEnum("users_role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  address: varchar("address", { length: 500 }),
  postcode: varchar("postcode", { length: 12 }),
  city: varchar("city", { length: 120 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  localLoginKey: varchar("localLoginKey", { length: 180 }).unique(),
  accountType: usersAccountTypeEnum("accountType")
    .default("particular")
    .notNull(),
  role: usersRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localCredentials = pgTable("mds_local_credentials", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id),
  passwordHash: varchar("passwordHash", { length: 128 }).notNull(),
  passwordSalt: varchar("passwordSalt", { length: 64 }).notNull(),
  failedAttempts: integer("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const localSessions = pgTable(
  "mds_local_sessions",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  },
  table => [index("local_sessions_user_idx").on(table.userId)]
);

export const localPasswordResets = pgTable(
  "mds_local_password_resets",
  {
    tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
    userId: integer("userId")
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
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
const id = () => serial("id").primaryKey();

export const adminInvitesStatusEnum = pgEnum("mds_admin_invites_status", [
  "pending",
  "active",
  "revoked",
]);

export const adminInvites = pgTable("mds_admin_invites", {
  id: id(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  status: adminInvitesStatusEnum("status").default("active").notNull(),
  invitedBy: integer("invitedBy").references(() => users.id),
  acceptedBy: integer("acceptedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),
  ...dates(),
});

export const artisanTeamRoleEnum = pgEnum("mds_artisan_team_role", [
  "technician",
  "assistant",
]);
export const artisanTeamStatusEnum = pgEnum("mds_artisan_team_status", [
  "pending",
  "active",
  "revoked",
]);

export const artisanTeam = pgTable(
  "mds_artisan_team",
  {
    id: id(),
    ownerUserId: integer("ownerUserId")
      .notNull()
      .references(() => users.id),
    userId: integer("userId").references(() => users.id),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("displayName", { length: 200 }).notNull(),
    role: artisanTeamRoleEnum("role").default("technician").notNull(),
    status: artisanTeamStatusEnum("status").default("pending").notNull(),
    ...dates(),
  },
  table => [
    uniqueIndex("artisan_team_owner_email").on(table.ownerUserId, table.email),
  ]
);

export const artisanAssignmentsStatusEnum = pgEnum(
  "mds_artisan_assignments_status",
  ["assigned", "completed", "cancelled"]
);

export const artisanAssignments = pgTable(
  "mds_artisan_assignments",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .references(() => requests.id),
    teamMemberId: integer("teamMemberId")
      .notNull()
      .references(() => artisanTeam.id),
    assignedBy: integer("assignedBy").references(() => users.id),
    status: artisanAssignmentsStatusEnum("status")
      .default("assigned")
      .notNull(),
    ...dates(),
  },
  table => [uniqueIndex("artisan_assignment_request").on(table.requestId)]
);

export const settings = pgTable("mds_settings", {
  id: integer("id").primaryKey(),
  zone: varchar("zone", { length: 300 }).default("").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).default("").notNull(),
  contactPhone: varchar("contactPhone", { length: 30 }).default("").notNull(),
  businessAddress: varchar("businessAddress", { length: 500 })
    .default("")
    .notNull(),
  legalName: varchar("legalName", { length: 200 }).default("").notNull(),
  legalNotice: text("legalNotice").notNull(),
  proposalExpiryHours: integer("proposalExpiryHours").default(72).notNull(),
  artisanUserId: integer("artisanUserId").references(() => users.id),
  activationHash: varchar("activationHash", { length: 64 }),
  trackingSecret: varchar("trackingSecret", { length: 64 }),
  activationUsedAt: timestamp("activationUsedAt"),
  calendarEnabled: boolean("calendarEnabled").default(false).notNull(),
  calendarTimezone: varchar("calendarTimezone", { length: 80 })
    .default("Europe/Paris")
    .notNull(),
  weeklyWindows: json("weeklyWindows").$type<WeeklyWindow[]>(),
  travelZones: json("travelZones").$type<TravelZone[]>(),
  bufferMinutes: integer("bufferMinutes").default(0).notNull(),
  horizonDays: integer("horizonDays").default(90).notNull(),
  remindersEnabled: boolean("remindersEnabled").default(false).notNull(),
  reminderHours: integer("reminderHours").default(24).notNull(),
  proposalReminderHours: integer("proposalReminderHours").default(6).notNull(),
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  smsEnabled: boolean("smsEnabled").default(false).notNull(),
  publicOrigin: varchar("publicOrigin", { length: 1000 }).default("").notNull(),
  emailFrom: varchar("emailFrom", { length: 320 }).default("").notNull(),
  smsFrom: varchar("smsFrom", { length: 80 }).default("").notNull(),
  ...dates(),
});
export const seedVersions = pgTable("mds_seed_versions", {
  version: varchar("version", { length: 100 }).primaryKey(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
});
export const servicesTradeEnum = pgEnum("mds_services_trade", [
  "plomberie",
  "electricite",
  "chauffage",
  "peinture",
  "maintenance",
]);
export const servicesPricingModeEnum = pgEnum("mds_services_pricingMode", [
  "fixed",
  "quote",
]);
export const servicesTravelModeEnum = pgEnum("mds_services_travelMode", [
  "unconfigured",
  "included",
  "fixed",
  "postcode",
]);

export const services = pgTable("mds_services", {
  id: id(),
  seedKey: varchar("seedKey", { length: 150 }).unique(),
  trade: servicesTradeEnum("trade").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  photoUrl: varchar("photoUrl", { length: 1000 }).default("").notNull(),
  priceCents: integer("priceCents"),
  pricingRule: varchar("pricingRule", { length: 500 }).notNull(),
  durationMinutes: integer("durationMinutes").default(60).notNull(),
  pricingMode: servicesPricingModeEnum("pricingMode")
    .default("quote")
    .notNull(),
  pricingVersion: integer("pricingVersion").default(0).notNull(),
  included: text("included"),
  excluded: text("excluded"),
  travelMode: servicesTravelModeEnum("travelMode")
    .default("unconfigured")
    .notNull(),
  travelFeeCents: integer("travelFeeCents"),
  travelRules: json("travelRules").$type<TravelRule[]>(),
  questions: json("questions").$type<string[]>().notNull(),
  problemTypes: json("problemTypes").$type<string[]>().notNull(),
  conditions: text("conditions").notNull(),
  zone: varchar("zone", { length: 300 }).default("").notNull(),
  active: boolean("active").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  ...dates(),
});
export const tariffs = pgTable("mds_tariffs", {
  id: id(),
  serviceId: integer("serviceId")
    .notNull()
    .references(() => services.id),
  priceCents: integer("priceCents"),
  rule: text("rule").notNull(),
  configuration: json("configuration").$type<PricingRules>(),
  validFrom: timestamp("validFrom").defaultNow().notNull(),
  validUntil: timestamp("validUntil"),
  ...dates(),
});
export const organizationsTypeEnum = pgEnum("mds_organizations_type", [
  "entreprise",
  "syndic",
  "bailleur",
  "gestionnaire",
  "association",
  "collectivite",
]);

export const organizations = pgTable("mds_organizations", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  type: organizationsTypeEnum("type").notNull(),
  ownerUserId: integer("ownerUserId")
    .notNull()
    .references(() => users.id),
  ...dates(),
});
export const membersRoleEnum = pgEnum("mds_members_role", [
  "owner",
  "manager",
  "member",
]);

export const members = pgTable(
  "mds_members",
  {
    id: id(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    role: membersRoleEnum("role").notNull(),
    ...dates(),
  },
  t => [uniqueIndex("member_org_user").on(t.organizationId, t.userId)]
);
export const invitationsRoleEnum = pgEnum("mds_invitations_role", [
  "manager",
  "member",
]);

export const invitations = pgTable("mds_invitations", {
  id: id(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id),
  email: varchar("email", { length: 320 }).notNull(),
  role: invitationsRoleEnum("role").notNull(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  invitedBy: integer("invitedBy")
    .notNull()
    .references(() => users.id),
  acceptedBy: integer("acceptedBy").references(() => users.id),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  ...dates(),
});
export const sites = pgTable("mds_sites", {
  id: id(),
  organizationId: integer("organizationId")
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
export const clients = pgTable("mds_clients", {
  id: id(),
  userId: integer("userId").references(() => users.id),
  organizationId: integer("organizationId").references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  ...dates(),
});
export const requestsStatusEnum = pgEnum("mds_requests_status", [
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
]);
export const requestsQuoteStatusEnum = pgEnum("mds_requests_quoteStatus", [
  "none",
  "pending",
  "accepted",
  "refused",
]);

export const requests = pgTable(
  "mds_requests",
  {
    id: id(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    trackingHash: varchar("trackingHash", { length: 64 }).notNull(),
    idempotencyHash: varchar("idempotencyHash", { length: 64 })
      .notNull()
      .unique(),
    payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
    userId: integer("userId").references(() => users.id),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id),
    serviceId: integer("serviceId").references(() => services.id),
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
    organizationId: integer("organizationId").references(
      () => organizations.id
    ),
    siteId: integer("siteId").references(() => sites.id),
    pricingSnapshot: json("pricingSnapshot").$type<PricingSnapshot>(),
    alternatives: json("alternatives").$type<AlternativeSlot[]>(),
    departedAt: timestamp("departedAt"),
    answers: json("answers").$type<Record<string, string>>().notNull(),
    consentAt: timestamp("consentAt").notNull(),
    status: requestsStatusEnum("status").notNull(),
    version: integer("version").default(0).notNull(),
    proposedStart: timestamp("proposedStart"),
    proposedPriceCents: integer("proposedPriceCents"),
    durationMinutes: integer("durationMinutes").default(60).notNull(),
    proposalMessage: text("proposalMessage"),
    expiresAt: timestamp("expiresAt"),
    quoteStatus: requestsQuoteStatusEnum("quoteStatus")
      .default("none")
      .notNull(),
    lastAction: varchar("lastAction", { length: 40 }),
    lastActionVersion: integer("lastActionVersion"),
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
export const waitlistEntriesReasonEnum = pgEnum("mds_waitlist_entries_reason", [
  "no_slot",
  "client_preference",
  "capacity",
]);
export const waitlistEntriesStatusEnum = pgEnum("mds_waitlist_entries_status", [
  "waiting",
  "contacted",
  "converted",
  "cancelled",
]);

export const waitlistEntries = pgTable(
  "mds_waitlist_entries",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .unique()
      .references(() => requests.id),
    reason: waitlistEntriesReasonEnum("reason").notNull().default("no_slot"),
    status: waitlistEntriesStatusEnum("status").notNull().default("waiting"),
    requestedStart: timestamp("requestedStart"),
    contactedAt: timestamp("contactedAt"),
    convertedAt: timestamp("convertedAt"),
    ...dates(),
  },
  t => [index("waitlist_status_created").on(t.status, t.createdAt)]
);
export const eventsActorTypeEnum = pgEnum("mds_events_actorType", [
  "client",
  "artisan",
  "system",
]);

export const events = pgTable("mds_events", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  status: varchar("status", { length: 40 }).notNull(),
  message: text("message").notNull(),
  actorType: eventsActorTypeEnum("actorType").notNull(),
  actorUserId: integer("actorUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const appointmentsStatusEnum = pgEnum("mds_appointments_status", [
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const appointments = pgTable(
  "mds_appointments",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .unique()
      .references(() => requests.id),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt").notNull(),
    status: appointmentsStatusEnum("status").notNull(),
    travelMinutes: integer("travelMinutes").default(0).notNull(),
    bufferMinutes: integer("bufferMinutes").default(0).notNull(),
    ...dates(),
  },
  t => [index("appointments_start").on(t.startAt)]
);
export const interventions = pgTable("mds_interventions", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .unique()
    .references(() => requests.id),
  appointmentId: integer("appointmentId")
    .notNull()
    .unique()
    .references(() => appointments.id),
  startedAt: timestamp("startedAt"),
  arrivedAt: timestamp("arrivedAt"),
  // Destination géocodée une seule fois au premier point GPS du trajet.
  destinationLatE6: integer("destinationLatE6"),
  destinationLngE6: integer("destinationLngE6"),
  approachNotifiedAt: timestamp("approachNotifiedAt"),
  completedAt: timestamp("completedAt"),
  summary: text("summary"),
  clientConfirmedAt: timestamp("clientConfirmedAt"),
  clientConfirmationMessage: text("clientConfirmationMessage"),
  clientSignedAt: timestamp("clientSignedAt"),
  clientSignatureDocumentId: integer("clientSignatureDocumentId").references(
    () => documents.id
  ),
  ...dates(),
});
export const availabilityKindEnum = pgEnum("mds_availability_kind", [
  "available",
  "blocked",
]);

export const availability = pgTable("mds_availability", {
  id: id(),
  artisanUserId: integer("artisanUserId")
    .notNull()
    .references(() => users.id),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  kind: availabilityKindEnum("kind").notNull(),
  note: text("note"),
  ...dates(),
});
export const documentsKindEnum = pgEnum("mds_documents_kind", [
  "photo",
  "quote",
  "invoice",
  "contract",
  "other",
  "signature",
]);
export const documentsPhotoStageEnum = pgEnum("mds_documents_photoStage", [
  "before",
  "after",
  "other",
]);
export const documentsPhotoAuthorEnum = pgEnum("mds_documents_photoAuthor", [
  "client",
  "artisan",
  "other",
]);

export const documents = pgTable("mds_documents", {
  id: id(),
  requestId: integer("requestId").references(() => requests.id),
  organizationId: integer("organizationId").references(() => organizations.id),
  uploadedBy: integer("uploadedBy").references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  kind: documentsKindEnum("kind").notNull(),
  photoStage: documentsPhotoStageEnum("photoStage").default("other").notNull(),
  photoAuthor: documentsPhotoAuthorEnum("photoAuthor")
    .default("other")
    .notNull(),
  description: varchar("description", { length: 500 }),
  byteSize: integer("byteSize").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  encryptionKey: varchar("encryptionKey", { length: 64 }).notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("authTag", { length: 32 }).notNull(),
  ...dates(),
});
export const quotesStatusEnum = pgEnum("mds_quotes_status", [
  "pending",
  "accepted",
  "refused",
  "superseded",
]);

export const quotes = pgTable("mds_quotes", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  documentId: integer("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  status: quotesStatusEnum("status").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  content: json("content").$type<QuoteContent>(),
  amountCents: integer("amountCents"),
  issuedAt: timestamp("issuedAt"),
  ...dates(),
});
export const contractsStatusEnum = pgEnum("mds_contracts_status", [
  "indexed",
  "active",
  "ended",
]);

export const contracts = pgTable("mds_contracts", {
  id: id(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id),
  documentId: integer("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  name: varchar("name", { length: 200 }).notNull(),
  status: contractsStatusEnum("status").default("indexed").notNull(),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  ...dates(),
});
export const invoices = pgTable("mds_invoices", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .unique()
    .references(() => requests.id),
  documentId: integer("documentId")
    .notNull()
    .unique()
    .references(() => documents.id),
  amountCents: integer("amountCents"),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
  paymentVerifiedBy: integer("paymentVerifiedBy").references(() => users.id),
  verificationNote: text("verificationNote"),
});
export const notificationsAudienceEnum = pgEnum("mds_notifications_audience", [
  "artisan",
  "client",
]);

export const notifications = pgTable("mds_notifications", {
  id: id(),
  userId: integer("userId").references(() => users.id),
  organizationId: integer("organizationId").references(() => organizations.id),
  requestId: integer("requestId").references(() => requests.id),
  audience: notificationsAudienceEnum("audience").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const locationUpdates = pgTable(
  "mds_location_updates",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .references(() => requests.id),
    artisanUserId: integer("artisanUserId")
      .notNull()
      .references(() => users.id),
    latitudeE6: integer("latitudeE6").notNull(),
    longitudeE6: integer("longitudeE6").notNull(),
    accuracyM: integer("accuracyM"),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  t => [index("location_request_time").on(t.requestId, t.recordedAt)]
);
export const notificationReads = pgTable(
  "mds_notification_reads",
  {
    id: id(),
    notificationId: integer("notificationId")
      .notNull()
      .references(() => notifications.id),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("notification_read_user").on(t.notificationId, t.userId)]
);
export const reviewsAuthorTypeEnum = pgEnum("mds_reviews_authorType", [
  "artisan",
  "client",
]);
export const reviewsModerationEnum = pgEnum("mds_reviews_moderation", [
  "pending",
  "approved",
  "hidden",
]);

export const reviews = pgTable(
  "mds_reviews",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .references(() => requests.id),
    interventionId: integer("interventionId")
      .notNull()
      .references(() => interventions.id),
    authorUserId: integer("authorUserId")
      .notNull()
      .references(() => users.id),
    authorType: reviewsAuthorTypeEnum("authorType").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    moderation: reviewsModerationEnum("moderation")
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("review_request_role").on(t.requestId, t.authorType)]
);
export const audit = pgTable("mds_audit", {
  id: id(),
  actorUserId: integer("actorUserId").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: integer("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const siteVisits = pgTable(
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

export const paymentsPurposeEnum = pgEnum("mds_payments_purpose", [
  "full",
  "deposit",
  "balance",
]);
export const paymentsProviderEnum = pgEnum("mds_payments_provider", [
  "stripe",
  "manual",
]);
export const paymentsModeEnum = pgEnum("mds_payments_mode", [
  "test",
  "live",
  "offline",
]);
export const paymentsStatusEnum = pgEnum("mds_payments_status", [
  "pending",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
]);

export const payments = pgTable(
  "mds_payments",
  {
    id: id(),
    requestId: integer("requestId")
      .notNull()
      .references(() => requests.id),
    invoiceId: integer("invoiceId").references(() => invoices.id),
    planId: integer("planId"),
    purpose: paymentsPurposeEnum("purpose").default("full").notNull(),
    receivedAmountCents: integer("receivedAmountCents"),
    creditedAt: timestamp("creditedAt"),
    provider: paymentsProviderEnum("provider").notNull(),
    mode: paymentsModeEnum("mode").notNull(),
    status: paymentsStatusEnum("status").notNull(),
    amountCents: integer("amountCents").notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    checkoutSessionId: varchar("checkoutSessionId", { length: 255 }).unique(),
    paymentIntentId: varchar("paymentIntentId", { length: 255 }).unique(),
    checkoutKey: varchar("checkoutKey", { length: 100 }).unique(),
    reference: varchar("reference", { length: 255 }),
    verifiedBy: integer("verifiedBy").references(() => users.id),
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
export const paymentEventsModeEnum = pgEnum("mds_payment_events_mode", [
  "test",
  "live",
]);

export const paymentEvents = pgTable("mds_payment_events", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  provider: varchar("provider", { length: 30 }).notNull(),
  mode: paymentEventsModeEnum("mode").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  paymentId: integer("paymentId").references(() => payments.id),
  outcome: varchar("outcome", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export const quoteDraftsStatusEnum = pgEnum("mds_quote_drafts_status", [
  "draft",
  "generated",
  "issued",
]);

export const quoteDrafts = pgTable("mds_quote_drafts", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  version: integer("version").default(0).notNull(),
  status: quoteDraftsStatusEnum("status").default("draft").notNull(),
  content: json("content").$type<QuoteContent>().notNull(),
  totalCents: integer("totalCents").notNull(),
  documentId: integer("documentId").references(() => documents.id),
  reference: varchar("reference", { length: 80 }).notNull().unique(),
  ...dates(),
});
export const incidentsKindEnum = pgEnum("mds_incidents_kind", [
  "problem",
  "no_slot",
  "client_absent",
  "artisan_unavailable",
  "complaint",
  "payment_failed",
]);
export const incidentsStatusEnum = pgEnum("mds_incidents_status", [
  "open",
  "resolved",
]);
export const incidentsActorTypeEnum = pgEnum("mds_incidents_actorType", [
  "artisan",
  "client",
  "system",
]);

export const incidents = pgTable("mds_incidents", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  kind: incidentsKindEnum("kind").notNull(),
  message: text("message").notNull(),
  status: incidentsStatusEnum("status").default("open").notNull(),
  reportedBy: integer("reportedBy").references(() => users.id),
  actorType: incidentsActorTypeEnum("actorType").notNull(),
  resolution: text("resolution"),
  resolvedBy: integer("resolvedBy").references(() => users.id),
  resolvedAt: timestamp("resolvedAt"),
  ...dates(),
});
export const extraWorksStatusEnum = pgEnum("mds_extra_works_status", [
  "pending",
  "accepted",
  "refused",
  "cancelled",
  "in_progress",
  "completed",
]);

export const extraWorks = pgTable("mds_extra_works", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  scope: text("scope").notNull(),
  amountCents: integer("amountCents").notNull(),
  durationMinutes: integer("durationMinutes").notNull(),
  conditions: text("conditions").notNull(),
  documentId: integer("documentId").references(() => documents.id),
  status: extraWorksStatusEnum("status").default("pending").notNull(),
  version: integer("version").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  acceptedAt: timestamp("acceptedAt"),
  acceptedBy: integer("acceptedBy").references(() => users.id),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  ...dates(),
});
export const paymentPlansStatusEnum = pgEnum("mds_payment_plans_status", [
  "proposed",
  "accepted",
  "refused",
  "cancelled",
]);

export const paymentPlans = pgTable("mds_payment_plans", {
  id: id(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  version: integer("version").default(0).notNull(),
  totalCents: integer("totalCents").notNull(),
  depositCents: integer("depositCents").notNull(),
  conditions: text("conditions").notNull(),
  status: paymentPlansStatusEnum("status").default("proposed").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  ...dates(),
});
export const refundsModeEnum = pgEnum("mds_refunds_mode", ["test", "live"]);
export const refundsStatusEnum = pgEnum("mds_refunds_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

export const refunds = pgTable("mds_refunds", {
  id: id(),
  paymentId: integer("paymentId")
    .notNull()
    .references(() => payments.id),
  amountCents: integer("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  mode: refundsModeEnum("mode").notNull(),
  status: refundsStatusEnum("status").notNull(),
  providerRefundId: varchar("providerRefundId", { length: 255 }).unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  reason: text("reason").notNull(),
  requestedBy: integer("requestedBy")
    .notNull()
    .references(() => users.id),
  confirmedAt: timestamp("confirmedAt"),
  ...dates(),
});
export const messageOutboxChannelEnum = pgEnum("mds_message_outbox_channel", [
  "email",
  "sms",
]);
export const messageOutboxStatusEnum = pgEnum("mds_message_outbox_status", [
  "queued",
  "sending",
  "accepted",
  "delivered",
  "failed",
  "disabled",
  "uncertain",
  "cancelled",
]);

export const messageOutbox = pgTable("mds_message_outbox", {
  id: id(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  requestId: integer("requestId").references(() => requests.id),
  userId: integer("userId").references(() => users.id),
  organizationId: integer("organizationId").references(() => organizations.id),
  channel: messageOutboxChannelEnum("channel").notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  status: messageOutboxStatusEnum("status").notNull(),
  providerId: varchar("providerId", { length: 255 }),
  attempts: integer("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  leaseUntil: timestamp("leaseUntil"),
  lastError: varchar("lastError", { length: 500 }),
  acceptedAt: timestamp("acceptedAt"),
  deliveredAt: timestamp("deliveredAt"),
  ...dates(),
});
export const assistantActionsActionTypeEnum = pgEnum(
  "mds_assistant_actions_actionType",
  [
    "follow_up",
    "quote_review",
    "invoice_review",
    "appointment_confirmation",
    "call_script",
  ]
);
export const assistantActionsChannelEnum = pgEnum(
  "mds_assistant_actions_channel",
  ["email", "sms", "call"]
);
export const assistantActionsStatusEnum = pgEnum(
  "mds_assistant_actions_status",
  [
    "proposed",
    "approved",
    "sent",
    "failed",
    "cancelled",
    // Validated by the artisan, waiting for scheduledFor. Appended last so the
    // existing enum values keep their position in MySQL.
    "scheduled",
  ]
);

export const assistantActions = pgTable(
  "mds_assistant_actions",
  {
    id: id(),
    requestId: integer("requestId").references(() => requests.id),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id),
    actionType: assistantActionsActionTypeEnum("actionType").notNull(),
    channel: assistantActionsChannelEnum("channel").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    body: text("body").notNull(),
    status: assistantActionsStatusEnum("status").default("proposed").notNull(),
    dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
    lastError: varchar("lastError", { length: 500 }),
    scheduledFor: timestamp("scheduledFor"),
    approvedAt: timestamp("approvedAt"),
    completedAt: timestamp("completedAt"),
    ...dates(),
  },
  table => [
    index("assistant_actions_request").on(table.requestId),
    index("assistant_actions_status").on(table.status),
    index("assistant_actions_due").on(table.status, table.scheduledFor),
  ]
);
export const voiceCallLogsDirectionEnum = pgEnum(
  "mds_voice_call_logs_direction",
  ["inbound", "outbound"]
);
export const voiceCallLogsStatusEnum = pgEnum("mds_voice_call_logs_status", [
  "received",
  "in_progress",
  "completed",
  "failed",
]);

export const voiceCallLogs = pgTable(
  "mds_voice_call_logs",
  {
    id: id(),
    callSid: varchar("callSid", { length: 120 }).notNull().unique(),
    fromNumber: varchar("fromNumber", { length: 30 }),
    toNumber: varchar("toNumber", { length: 30 }),
    direction: voiceCallLogsDirectionEnum("direction").notNull(),
    status: voiceCallLogsStatusEnum("status").default("received").notNull(),
    requestId: integer("requestId").references(() => requests.id),
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
export const remindersKindEnum = pgEnum("mds_reminders_kind", [
  "proposal",
  "appointment",
]);

export const reminders = pgTable("mds_reminders", {
  id: id(),
  dedupeKey: varchar("dedupeKey", { length: 180 }).notNull().unique(),
  requestId: integer("requestId")
    .notNull()
    .references(() => requests.id),
  kind: remindersKindEnum("kind").notNull(),
  dueAt: timestamp("dueAt").notNull(),
  sentAt: timestamp("sentAt"),
  ...dates(),
});
export const automationTasks = pgTable("mds_automation_tasks", {
  id: integer("id").primaryKey(),
  taskUid: varchar("taskUid", { length: 255 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  ...dates(),
});
export const automationRunsSourceEnum = pgEnum("mds_automation_runs_source", [
  "scheduled",
  "manual",
]);
export const automationRunsStatusEnum = pgEnum("mds_automation_runs_status", [
  "running",
  "succeeded",
  "failed",
]);

export const automationRuns = pgTable("mds_automation_runs", {
  id: id(),
  runKey: varchar("runKey", { length: 180 }).notNull().unique(),
  taskUid: varchar("taskUid", { length: 255 }),
  source: automationRunsSourceEnum("source").notNull(),
  status: automationRunsStatusEnum("status").notNull(),
  summary: json("summary").$type<Record<string, number>>(),
  error: varchar("error", { length: 500 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});
