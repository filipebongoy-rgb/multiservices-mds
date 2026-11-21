CREATE TYPE "public"."mds_admin_invites_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."mds_appointments_status" AS ENUM('confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_artisan_assignments_status" AS ENUM('assigned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_artisan_team_role" AS ENUM('technician', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."mds_artisan_team_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."mds_assistant_actions_actionType" AS ENUM('follow_up', 'quote_review', 'invoice_review', 'appointment_confirmation', 'call_script');--> statement-breakpoint
CREATE TYPE "public"."mds_assistant_actions_channel" AS ENUM('email', 'sms', 'call');--> statement-breakpoint
CREATE TYPE "public"."mds_assistant_actions_status" AS ENUM('proposed', 'approved', 'sent', 'failed', 'cancelled', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."mds_automation_runs_source" AS ENUM('scheduled', 'manual');--> statement-breakpoint
CREATE TYPE "public"."mds_automation_runs_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mds_availability_kind" AS ENUM('available', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."mds_contracts_status" AS ENUM('indexed', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."mds_documents_kind" AS ENUM('photo', 'quote', 'invoice', 'contract', 'other', 'signature');--> statement-breakpoint
CREATE TYPE "public"."mds_documents_photoAuthor" AS ENUM('client', 'artisan', 'other');--> statement-breakpoint
CREATE TYPE "public"."mds_documents_photoStage" AS ENUM('before', 'after', 'other');--> statement-breakpoint
CREATE TYPE "public"."mds_events_actorType" AS ENUM('client', 'artisan', 'system');--> statement-breakpoint
CREATE TYPE "public"."mds_extra_works_status" AS ENUM('pending', 'accepted', 'refused', 'cancelled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."mds_incidents_actorType" AS ENUM('artisan', 'client', 'system');--> statement-breakpoint
CREATE TYPE "public"."mds_incidents_kind" AS ENUM('problem', 'no_slot', 'client_absent', 'artisan_unavailable', 'complaint', 'payment_failed');--> statement-breakpoint
CREATE TYPE "public"."mds_incidents_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."mds_invitations_role" AS ENUM('manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."mds_members_role" AS ENUM('owner', 'manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."mds_message_outbox_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."mds_message_outbox_status" AS ENUM('queued', 'sending', 'accepted', 'delivered', 'failed', 'disabled', 'uncertain', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_notifications_audience" AS ENUM('artisan', 'client');--> statement-breakpoint
CREATE TYPE "public"."mds_organizations_type" AS ENUM('entreprise', 'syndic', 'bailleur', 'gestionnaire', 'association', 'collectivite');--> statement-breakpoint
CREATE TYPE "public"."mds_payment_events_mode" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."mds_payment_plans_status" AS ENUM('proposed', 'accepted', 'refused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_payments_mode" AS ENUM('test', 'live', 'offline');--> statement-breakpoint
CREATE TYPE "public"."mds_payments_provider" AS ENUM('stripe', 'manual');--> statement-breakpoint
CREATE TYPE "public"."mds_payments_purpose" AS ENUM('full', 'deposit', 'balance');--> statement-breakpoint
CREATE TYPE "public"."mds_payments_status" AS ENUM('pending', 'succeeded', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_quote_drafts_status" AS ENUM('draft', 'generated', 'issued');--> statement-breakpoint
CREATE TYPE "public"."mds_quotes_status" AS ENUM('pending', 'accepted', 'refused', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."mds_refunds_mode" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."mds_refunds_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mds_reminders_kind" AS ENUM('proposal', 'appointment');--> statement-breakpoint
CREATE TYPE "public"."mds_requests_quoteStatus" AS ENUM('none', 'pending', 'accepted', 'refused');--> statement-breakpoint
CREATE TYPE "public"."mds_requests_status" AS ENUM('draft', 'sent', 'awaiting_mds', 'to_analyze', 'accepted_mds', 'proposed_slot', 'needs_information', 'awaiting_client', 'confirmed', 'refused', 'cancelled', 'planned', 'en_route', 'in_progress', 'completed', 'invoiced', 'paid', 'closed', 'expired', 'quote_pending', 'quote_accepted', 'quote_refused');--> statement-breakpoint
CREATE TYPE "public"."mds_reviews_authorType" AS ENUM('artisan', 'client');--> statement-breakpoint
CREATE TYPE "public"."mds_reviews_moderation" AS ENUM('pending', 'approved', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."mds_services_pricingMode" AS ENUM('fixed', 'quote');--> statement-breakpoint
CREATE TYPE "public"."mds_services_trade" AS ENUM('plomberie', 'electricite', 'chauffage', 'peinture', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."mds_services_travelMode" AS ENUM('unconfigured', 'included', 'fixed', 'postcode');--> statement-breakpoint
CREATE TYPE "public"."users_accountType" AS ENUM('particular', 'professional');--> statement-breakpoint
CREATE TYPE "public"."users_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."mds_voice_call_logs_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."mds_voice_call_logs_status" AS ENUM('received', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mds_waitlist_entries_reason" AS ENUM('no_slot', 'client_preference', 'capacity');--> statement-breakpoint
CREATE TYPE "public"."mds_waitlist_entries_status" AS ENUM('waiting', 'contacted', 'converted', 'cancelled');--> statement-breakpoint
CREATE TABLE "mds_admin_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" "mds_admin_invites_status" DEFAULT 'active' NOT NULL,
	"invitedBy" integer,
	"acceptedBy" integer,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_admin_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mds_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp NOT NULL,
	"status" "mds_appointments_status" NOT NULL,
	"travelMinutes" integer DEFAULT 0 NOT NULL,
	"bufferMinutes" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_appointments_requestId_unique" UNIQUE("requestId")
);
--> statement-breakpoint
CREATE TABLE "mds_artisan_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"teamMemberId" integer NOT NULL,
	"assignedBy" integer,
	"status" "mds_artisan_assignments_status" DEFAULT 'assigned' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_artisan_team" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerUserId" integer NOT NULL,
	"userId" integer,
	"email" varchar(320) NOT NULL,
	"displayName" varchar(200) NOT NULL,
	"role" "mds_artisan_team_role" DEFAULT 'technician' NOT NULL,
	"status" "mds_artisan_team_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_assistant_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer,
	"createdBy" integer NOT NULL,
	"actionType" "mds_assistant_actions_actionType" NOT NULL,
	"channel" "mds_assistant_actions_channel" NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" "mds_assistant_actions_status" DEFAULT 'proposed' NOT NULL,
	"dedupeKey" varchar(180) NOT NULL,
	"lastError" varchar(500),
	"scheduledFor" timestamp,
	"approvedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_assistant_actions_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "mds_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer,
	"action" varchar(100) NOT NULL,
	"entityType" varchar(50) NOT NULL,
	"entityId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"runKey" varchar(180) NOT NULL,
	"taskUid" varchar(255),
	"source" "mds_automation_runs_source" NOT NULL,
	"status" "mds_automation_runs_status" NOT NULL,
	"summary" json,
	"error" varchar(500),
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp,
	CONSTRAINT "mds_automation_runs_runKey_unique" UNIQUE("runKey")
);
--> statement-breakpoint
CREATE TABLE "mds_automation_tasks" (
	"id" integer PRIMARY KEY NOT NULL,
	"taskUid" varchar(255),
	"enabled" boolean DEFAULT false NOT NULL,
	"lastRunAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_automation_tasks_taskUid_unique" UNIQUE("taskUid")
);
--> statement-breakpoint
CREATE TABLE "mds_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"artisanUserId" integer NOT NULL,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp NOT NULL,
	"kind" "mds_availability_kind" NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"organizationId" integer,
	"name" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" "mds_contracts_status" DEFAULT 'indexed' NOT NULL,
	"startAt" timestamp,
	"endAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_contracts_documentId_unique" UNIQUE("documentId")
);
--> statement-breakpoint
CREATE TABLE "mds_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer,
	"organizationId" integer,
	"uploadedBy" integer,
	"name" varchar(200) NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"kind" "mds_documents_kind" NOT NULL,
	"photoStage" "mds_documents_photoStage" DEFAULT 'other' NOT NULL,
	"photoAuthor" "mds_documents_photoAuthor" DEFAULT 'other' NOT NULL,
	"description" varchar(500),
	"byteSize" integer NOT NULL,
	"storageKey" varchar(500) NOT NULL,
	"encryptionKey" varchar(64) NOT NULL,
	"iv" varchar(32) NOT NULL,
	"authTag" varchar(32) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"status" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"actorType" "mds_events_actorType" NOT NULL,
	"actorUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_extra_works" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"scope" text NOT NULL,
	"amountCents" integer NOT NULL,
	"durationMinutes" integer NOT NULL,
	"conditions" text NOT NULL,
	"documentId" integer,
	"status" "mds_extra_works_status" DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp,
	"acceptedAt" timestamp,
	"acceptedBy" integer,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"kind" "mds_incidents_kind" NOT NULL,
	"message" text NOT NULL,
	"status" "mds_incidents_status" DEFAULT 'open' NOT NULL,
	"reportedBy" integer,
	"actorType" "mds_incidents_actorType" NOT NULL,
	"resolution" text,
	"resolvedBy" integer,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_interventions" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"appointmentId" integer NOT NULL,
	"startedAt" timestamp,
	"arrivedAt" timestamp,
	"destinationLatE6" integer,
	"destinationLngE6" integer,
	"approachNotifiedAt" timestamp,
	"completedAt" timestamp,
	"summary" text,
	"clientConfirmedAt" timestamp,
	"clientConfirmationMessage" text,
	"clientSignedAt" timestamp,
	"clientSignatureDocumentId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_interventions_requestId_unique" UNIQUE("requestId"),
	CONSTRAINT "mds_interventions_appointmentId_unique" UNIQUE("appointmentId")
);
--> statement-breakpoint
CREATE TABLE "mds_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "mds_invitations_role" NOT NULL,
	"codeHash" varchar(64) NOT NULL,
	"invitedBy" integer NOT NULL,
	"acceptedBy" integer,
	"acceptedAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_invitations_codeHash_unique" UNIQUE("codeHash")
);
--> statement-breakpoint
CREATE TABLE "mds_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"amountCents" integer,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	"paidAt" timestamp,
	"paymentVerifiedBy" integer,
	"verificationNote" text,
	CONSTRAINT "mds_invoices_requestId_unique" UNIQUE("requestId"),
	CONSTRAINT "mds_invoices_documentId_unique" UNIQUE("documentId")
);
--> statement-breakpoint
CREATE TABLE "mds_local_credentials" (
	"userId" integer PRIMARY KEY NOT NULL,
	"passwordHash" varchar(128) NOT NULL,
	"passwordSalt" varchar(64) NOT NULL,
	"failedAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_local_password_resets" (
	"tokenHash" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_local_sessions" (
	"tokenHash" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_location_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"artisanUserId" integer NOT NULL,
	"latitudeE6" integer NOT NULL,
	"longitudeE6" integer NOT NULL,
	"accuracyM" integer,
	"recordedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "mds_members_role" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_message_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupeKey" varchar(180) NOT NULL,
	"requestId" integer,
	"userId" integer,
	"organizationId" integer,
	"channel" "mds_message_outbox_channel" NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" "mds_message_outbox_status" NOT NULL,
	"providerId" varchar(255),
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp,
	"leaseUntil" timestamp,
	"lastError" varchar(500),
	"acceptedAt" timestamp,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_message_outbox_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "mds_notification_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"notificationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"readAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"organizationId" integer,
	"requestId" integer,
	"audience" "mds_notifications_audience" NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "mds_organizations_type" NOT NULL,
	"ownerUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_payment_events" (
	"eventId" varchar(255) PRIMARY KEY NOT NULL,
	"provider" varchar(30) NOT NULL,
	"mode" "mds_payment_events_mode" NOT NULL,
	"type" varchar(100) NOT NULL,
	"paymentId" integer,
	"outcome" varchar(100) NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_payment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"totalCents" integer NOT NULL,
	"depositCents" integer NOT NULL,
	"conditions" text NOT NULL,
	"status" "mds_payment_plans_status" DEFAULT 'proposed' NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"invoiceId" integer,
	"planId" integer,
	"purpose" "mds_payments_purpose" DEFAULT 'full' NOT NULL,
	"receivedAmountCents" integer,
	"creditedAt" timestamp,
	"provider" "mds_payments_provider" NOT NULL,
	"mode" "mds_payments_mode" NOT NULL,
	"status" "mds_payments_status" NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"checkoutSessionId" varchar(255),
	"paymentIntentId" varchar(255),
	"checkoutKey" varchar(100),
	"reference" varchar(255),
	"verifiedBy" integer,
	"verificationNote" text,
	"expiresAt" timestamp,
	"confirmedAt" timestamp,
	"failureReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_payments_checkoutSessionId_unique" UNIQUE("checkoutSessionId"),
	CONSTRAINT "mds_payments_paymentIntentId_unique" UNIQUE("paymentIntentId"),
	CONSTRAINT "mds_payments_checkoutKey_unique" UNIQUE("checkoutKey")
);
--> statement-breakpoint
CREATE TABLE "mds_quote_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"status" "mds_quote_drafts_status" DEFAULT 'draft' NOT NULL,
	"content" json NOT NULL,
	"totalCents" integer NOT NULL,
	"documentId" integer,
	"reference" varchar(80) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_quote_drafts_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "mds_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"documentId" integer NOT NULL,
	"status" "mds_quotes_status" NOT NULL,
	"acceptedAt" timestamp,
	"content" json,
	"amountCents" integer,
	"issuedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_quotes_documentId_unique" UNIQUE("documentId")
);
--> statement-breakpoint
CREATE TABLE "mds_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"paymentId" integer NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"mode" "mds_refunds_mode" NOT NULL,
	"status" "mds_refunds_status" NOT NULL,
	"providerRefundId" varchar(255),
	"idempotencyKey" varchar(100) NOT NULL,
	"reason" text NOT NULL,
	"requestedBy" integer NOT NULL,
	"confirmedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_refunds_providerRefundId_unique" UNIQUE("providerRefundId"),
	CONSTRAINT "mds_refunds_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "mds_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupeKey" varchar(180) NOT NULL,
	"requestId" integer NOT NULL,
	"kind" "mds_reminders_kind" NOT NULL,
	"dueAt" timestamp NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_reminders_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "mds_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(40) NOT NULL,
	"trackingHash" varchar(64) NOT NULL,
	"idempotencyHash" varchar(64) NOT NULL,
	"payloadHash" varchar(64) NOT NULL,
	"userId" integer,
	"clientId" integer NOT NULL,
	"serviceId" integer,
	"serviceName" varchar(120),
	"description" text NOT NULL,
	"problemType" varchar(120) NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"address" varchar(250) NOT NULL,
	"postcode" varchar(5) NOT NULL,
	"city" varchar(100) NOT NULL,
	"desiredStart" timestamp,
	"organizationId" integer,
	"siteId" integer,
	"pricingSnapshot" json,
	"alternatives" json,
	"departedAt" timestamp,
	"answers" json NOT NULL,
	"consentAt" timestamp NOT NULL,
	"status" "mds_requests_status" NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"proposedStart" timestamp,
	"proposedPriceCents" integer,
	"durationMinutes" integer DEFAULT 60 NOT NULL,
	"proposalMessage" text,
	"expiresAt" timestamp,
	"quoteStatus" "mds_requests_quoteStatus" DEFAULT 'none' NOT NULL,
	"lastAction" varchar(40),
	"lastActionVersion" integer,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "mds_requests_idempotencyHash_unique" UNIQUE("idempotencyHash")
);
--> statement-breakpoint
CREATE TABLE "mds_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"interventionId" integer NOT NULL,
	"authorUserId" integer NOT NULL,
	"authorType" "mds_reviews_authorType" NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"moderation" "mds_reviews_moderation" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_seed_versions" (
	"version" varchar(100) PRIMARY KEY NOT NULL,
	"appliedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"seedKey" varchar(150),
	"trade" "mds_services_trade" NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"photoUrl" varchar(1000) DEFAULT '' NOT NULL,
	"priceCents" integer,
	"pricingRule" varchar(500) NOT NULL,
	"durationMinutes" integer DEFAULT 60 NOT NULL,
	"pricingMode" "mds_services_pricingMode" DEFAULT 'quote' NOT NULL,
	"pricingVersion" integer DEFAULT 0 NOT NULL,
	"included" text,
	"excluded" text,
	"travelMode" "mds_services_travelMode" DEFAULT 'unconfigured' NOT NULL,
	"travelFeeCents" integer,
	"travelRules" json,
	"questions" json NOT NULL,
	"problemTypes" json NOT NULL,
	"conditions" text NOT NULL,
	"zone" varchar(300) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_services_seedKey_unique" UNIQUE("seedKey")
);
--> statement-breakpoint
CREATE TABLE "mds_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"zone" varchar(300) DEFAULT '' NOT NULL,
	"contactEmail" varchar(320) DEFAULT '' NOT NULL,
	"contactPhone" varchar(30) DEFAULT '' NOT NULL,
	"businessAddress" varchar(500) DEFAULT '' NOT NULL,
	"legalName" varchar(200) DEFAULT '' NOT NULL,
	"legalNotice" text NOT NULL,
	"proposalExpiryHours" integer DEFAULT 72 NOT NULL,
	"artisanUserId" integer,
	"activationHash" varchar(64),
	"trackingSecret" varchar(64),
	"activationUsedAt" timestamp,
	"calendarEnabled" boolean DEFAULT false NOT NULL,
	"calendarTimezone" varchar(80) DEFAULT 'Europe/Paris' NOT NULL,
	"weeklyWindows" json,
	"travelZones" json,
	"bufferMinutes" integer DEFAULT 0 NOT NULL,
	"horizonDays" integer DEFAULT 90 NOT NULL,
	"remindersEnabled" boolean DEFAULT false NOT NULL,
	"reminderHours" integer DEFAULT 24 NOT NULL,
	"proposalReminderHours" integer DEFAULT 6 NOT NULL,
	"emailEnabled" boolean DEFAULT false NOT NULL,
	"smsEnabled" boolean DEFAULT false NOT NULL,
	"publicOrigin" varchar(1000) DEFAULT '' NOT NULL,
	"emailFrom" varchar(320) DEFAULT '' NOT NULL,
	"smsFrom" varchar(80) DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_site_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitorHash" varchar(64) NOT NULL,
	"visitDay" date NOT NULL,
	"path" varchar(120) DEFAULT '/' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" varchar(250) NOT NULL,
	"postcode" varchar(5) NOT NULL,
	"city" varchar(100) NOT NULL,
	"contactName" varchar(120) NOT NULL,
	"contactPhone" varchar(30) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mds_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"priceCents" integer,
	"rule" text NOT NULL,
	"configuration" json,
	"validFrom" timestamp DEFAULT now() NOT NULL,
	"validUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"phone" varchar(30),
	"address" varchar(500),
	"postcode" varchar(12),
	"city" varchar(120),
	"loginMethod" varchar(64),
	"localLoginKey" varchar(180),
	"accountType" "users_accountType" DEFAULT 'particular' NOT NULL,
	"role" "users_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_localLoginKey_unique" UNIQUE("localLoginKey")
);
--> statement-breakpoint
CREATE TABLE "mds_voice_call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"callSid" varchar(120) NOT NULL,
	"fromNumber" varchar(30),
	"toNumber" varchar(30),
	"direction" "mds_voice_call_logs_direction" NOT NULL,
	"status" "mds_voice_call_logs_status" DEFAULT 'received' NOT NULL,
	"requestId" integer,
	"transcript" text,
	"summary" text,
	"lastError" varchar(500),
	"startedAt" timestamp,
	"endedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_voice_call_logs_callSid_unique" UNIQUE("callSid")
);
--> statement-breakpoint
CREATE TABLE "mds_waitlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestId" integer NOT NULL,
	"reason" "mds_waitlist_entries_reason" DEFAULT 'no_slot' NOT NULL,
	"status" "mds_waitlist_entries_status" DEFAULT 'waiting' NOT NULL,
	"requestedStart" timestamp,
	"contactedAt" timestamp,
	"convertedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mds_waitlist_entries_requestId_unique" UNIQUE("requestId")
);
--> statement-breakpoint
ALTER TABLE "mds_admin_invites" ADD CONSTRAINT "mds_admin_invites_invitedBy_users_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_admin_invites" ADD CONSTRAINT "mds_admin_invites_acceptedBy_users_id_fk" FOREIGN KEY ("acceptedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_appointments" ADD CONSTRAINT "mds_appointments_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_artisan_assignments" ADD CONSTRAINT "mds_artisan_assignments_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_artisan_assignments" ADD CONSTRAINT "mds_artisan_assignments_teamMemberId_mds_artisan_team_id_fk" FOREIGN KEY ("teamMemberId") REFERENCES "public"."mds_artisan_team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_artisan_assignments" ADD CONSTRAINT "mds_artisan_assignments_assignedBy_users_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_artisan_team" ADD CONSTRAINT "mds_artisan_team_ownerUserId_users_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_artisan_team" ADD CONSTRAINT "mds_artisan_team_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_assistant_actions" ADD CONSTRAINT "mds_assistant_actions_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_assistant_actions" ADD CONSTRAINT "mds_assistant_actions_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_audit" ADD CONSTRAINT "mds_audit_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_availability" ADD CONSTRAINT "mds_availability_artisanUserId_users_id_fk" FOREIGN KEY ("artisanUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_clients" ADD CONSTRAINT "mds_clients_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_clients" ADD CONSTRAINT "mds_clients_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_contracts" ADD CONSTRAINT "mds_contracts_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_contracts" ADD CONSTRAINT "mds_contracts_documentId_mds_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_documents" ADD CONSTRAINT "mds_documents_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_documents" ADD CONSTRAINT "mds_documents_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_documents" ADD CONSTRAINT "mds_documents_uploadedBy_users_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_events" ADD CONSTRAINT "mds_events_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_events" ADD CONSTRAINT "mds_events_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_extra_works" ADD CONSTRAINT "mds_extra_works_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_extra_works" ADD CONSTRAINT "mds_extra_works_documentId_mds_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_extra_works" ADD CONSTRAINT "mds_extra_works_acceptedBy_users_id_fk" FOREIGN KEY ("acceptedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_incidents" ADD CONSTRAINT "mds_incidents_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_incidents" ADD CONSTRAINT "mds_incidents_reportedBy_users_id_fk" FOREIGN KEY ("reportedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_incidents" ADD CONSTRAINT "mds_incidents_resolvedBy_users_id_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_interventions" ADD CONSTRAINT "mds_interventions_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_interventions" ADD CONSTRAINT "mds_interventions_appointmentId_mds_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."mds_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_interventions" ADD CONSTRAINT "mds_interventions_clientSignatureDocumentId_mds_documents_id_fk" FOREIGN KEY ("clientSignatureDocumentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invitations" ADD CONSTRAINT "mds_invitations_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invitations" ADD CONSTRAINT "mds_invitations_invitedBy_users_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invitations" ADD CONSTRAINT "mds_invitations_acceptedBy_users_id_fk" FOREIGN KEY ("acceptedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invoices" ADD CONSTRAINT "mds_invoices_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invoices" ADD CONSTRAINT "mds_invoices_documentId_mds_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_invoices" ADD CONSTRAINT "mds_invoices_paymentVerifiedBy_users_id_fk" FOREIGN KEY ("paymentVerifiedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_local_credentials" ADD CONSTRAINT "mds_local_credentials_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_local_password_resets" ADD CONSTRAINT "mds_local_password_resets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_local_sessions" ADD CONSTRAINT "mds_local_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_location_updates" ADD CONSTRAINT "mds_location_updates_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_location_updates" ADD CONSTRAINT "mds_location_updates_artisanUserId_users_id_fk" FOREIGN KEY ("artisanUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_members" ADD CONSTRAINT "mds_members_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_members" ADD CONSTRAINT "mds_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_message_outbox" ADD CONSTRAINT "mds_message_outbox_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_message_outbox" ADD CONSTRAINT "mds_message_outbox_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_message_outbox" ADD CONSTRAINT "mds_message_outbox_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_notification_reads" ADD CONSTRAINT "mds_notification_reads_notificationId_mds_notifications_id_fk" FOREIGN KEY ("notificationId") REFERENCES "public"."mds_notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_notification_reads" ADD CONSTRAINT "mds_notification_reads_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_notifications" ADD CONSTRAINT "mds_notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_notifications" ADD CONSTRAINT "mds_notifications_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_notifications" ADD CONSTRAINT "mds_notifications_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_organizations" ADD CONSTRAINT "mds_organizations_ownerUserId_users_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_payment_events" ADD CONSTRAINT "mds_payment_events_paymentId_mds_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."mds_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_payment_plans" ADD CONSTRAINT "mds_payment_plans_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_payments" ADD CONSTRAINT "mds_payments_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_payments" ADD CONSTRAINT "mds_payments_invoiceId_mds_invoices_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."mds_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_payments" ADD CONSTRAINT "mds_payments_verifiedBy_users_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_quote_drafts" ADD CONSTRAINT "mds_quote_drafts_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_quote_drafts" ADD CONSTRAINT "mds_quote_drafts_documentId_mds_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_quotes" ADD CONSTRAINT "mds_quotes_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_quotes" ADD CONSTRAINT "mds_quotes_documentId_mds_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."mds_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_refunds" ADD CONSTRAINT "mds_refunds_paymentId_mds_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."mds_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_refunds" ADD CONSTRAINT "mds_refunds_requestedBy_users_id_fk" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_reminders" ADD CONSTRAINT "mds_reminders_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_requests" ADD CONSTRAINT "mds_requests_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_requests" ADD CONSTRAINT "mds_requests_clientId_mds_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."mds_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_requests" ADD CONSTRAINT "mds_requests_serviceId_mds_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."mds_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_requests" ADD CONSTRAINT "mds_requests_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_requests" ADD CONSTRAINT "mds_requests_siteId_mds_sites_id_fk" FOREIGN KEY ("siteId") REFERENCES "public"."mds_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_reviews" ADD CONSTRAINT "mds_reviews_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_reviews" ADD CONSTRAINT "mds_reviews_interventionId_mds_interventions_id_fk" FOREIGN KEY ("interventionId") REFERENCES "public"."mds_interventions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_reviews" ADD CONSTRAINT "mds_reviews_authorUserId_users_id_fk" FOREIGN KEY ("authorUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_settings" ADD CONSTRAINT "mds_settings_artisanUserId_users_id_fk" FOREIGN KEY ("artisanUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_sites" ADD CONSTRAINT "mds_sites_organizationId_mds_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."mds_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_tariffs" ADD CONSTRAINT "mds_tariffs_serviceId_mds_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."mds_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_voice_call_logs" ADD CONSTRAINT "mds_voice_call_logs_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mds_waitlist_entries" ADD CONSTRAINT "mds_waitlist_entries_requestId_mds_requests_id_fk" FOREIGN KEY ("requestId") REFERENCES "public"."mds_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_start" ON "mds_appointments" USING btree ("startAt");--> statement-breakpoint
CREATE UNIQUE INDEX "artisan_assignment_request" ON "mds_artisan_assignments" USING btree ("requestId");--> statement-breakpoint
CREATE UNIQUE INDEX "artisan_team_owner_email" ON "mds_artisan_team" USING btree ("ownerUserId","email");--> statement-breakpoint
CREATE INDEX "assistant_actions_request" ON "mds_assistant_actions" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "assistant_actions_status" ON "mds_assistant_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assistant_actions_due" ON "mds_assistant_actions" USING btree ("status","scheduledFor");--> statement-breakpoint
CREATE INDEX "local_password_resets_user_idx" ON "mds_local_password_resets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "local_sessions_user_idx" ON "mds_local_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "location_request_time" ON "mds_location_updates" USING btree ("requestId","recordedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user" ON "mds_members" USING btree ("organizationId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_read_user" ON "mds_notification_reads" USING btree ("notificationId","userId");--> statement-breakpoint
CREATE INDEX "payments_request" ON "mds_payments" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "payments_invoice" ON "mds_payments" USING btree ("invoiceId");--> statement-breakpoint
CREATE INDEX "requests_org" ON "mds_requests" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "requests_user" ON "mds_requests" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "requests_status" ON "mds_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_request_role" ON "mds_reviews" USING btree ("requestId","authorType");--> statement-breakpoint
CREATE UNIQUE INDEX "site_visits_visitor_day" ON "mds_site_visits" USING btree ("visitorHash","visitDay");--> statement-breakpoint
CREATE INDEX "voice_call_logs_status" ON "mds_voice_call_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_call_logs_request" ON "mds_voice_call_logs" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "waitlist_status_created" ON "mds_waitlist_entries" USING btree ("status","createdAt");
--> statement-breakpoint
-- Supabase expose le schéma public par son API : on active la sécurité par ligne
-- (sans règle = aucun accès pour les rôles anon/authenticated). Le serveur MDS
-- se connecte avec le rôle propriétaire de la base, qui n'est pas concerné.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND (tablename LIKE 'mds\_%' OR tablename = 'users')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', t.tablename);
  END LOOP;
END $$;
