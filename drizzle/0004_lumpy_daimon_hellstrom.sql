CREATE TABLE `mds_automation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(180) NOT NULL,
	`taskUid` varchar(255),
	`source` enum('scheduled','manual') NOT NULL,
	`status` enum('running','succeeded','failed') NOT NULL,
	`summary` json,
	`error` varchar(500),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `mds_automation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_automation_runs_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE TABLE `mds_automation_tasks` (
	`id` int NOT NULL,
	`taskUid` varchar(255),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_automation_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_automation_tasks_taskUid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
CREATE TABLE `mds_extra_works` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`scope` text NOT NULL,
	`amountCents` int NOT NULL,
	`durationMinutes` int NOT NULL,
	`conditions` text NOT NULL,
	`documentId` int,
	`status` enum('pending','accepted','refused','cancelled','in_progress','completed') NOT NULL DEFAULT 'pending',
	`version` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`acceptedAt` timestamp,
	`acceptedBy` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_extra_works_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`kind` enum('problem','no_slot','client_absent','artisan_unavailable','complaint','payment_failed') NOT NULL,
	`message` text NOT NULL,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`reportedBy` int,
	`actorType` enum('artisan','client','system') NOT NULL,
	`resolution` text,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_message_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dedupeKey` varchar(180) NOT NULL,
	`requestId` int,
	`userId` int,
	`organizationId` int,
	`channel` enum('email','sms') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`status` enum('queued','sending','accepted','delivered','failed','disabled','uncertain','cancelled') NOT NULL,
	`providerId` varchar(255),
	`attempts` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp,
	`leaseUntil` timestamp,
	`lastError` varchar(500),
	`acceptedAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_message_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_message_outbox_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `mds_payment_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`version` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`depositCents` int NOT NULL,
	`conditions` text NOT NULL,
	`status` enum('proposed','accepted','refused','cancelled') NOT NULL DEFAULT 'proposed',
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_payment_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_quote_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`version` int NOT NULL DEFAULT 0,
	`status` enum('draft','generated','issued') NOT NULL DEFAULT 'draft',
	`content` json NOT NULL,
	`totalCents` int NOT NULL,
	`documentId` int,
	`reference` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_quote_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_quote_drafts_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `mds_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` int NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`mode` enum('test','live') NOT NULL,
	`status` enum('pending','succeeded','failed','cancelled') NOT NULL,
	`providerRefundId` varchar(255),
	`idempotencyKey` varchar(100) NOT NULL,
	`reason` text NOT NULL,
	`requestedBy` int NOT NULL,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_refunds_providerRefundId_unique` UNIQUE(`providerRefundId`),
	CONSTRAINT `mds_refunds_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `mds_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dedupeKey` varchar(180) NOT NULL,
	`requestId` int NOT NULL,
	`kind` enum('proposal','appointment') NOT NULL,
	`dueAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_reminders_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `mds_payments` MODIFY COLUMN `invoiceId` int;--> statement-breakpoint
ALTER TABLE `mds_requests` MODIFY COLUMN `status` enum('draft','sent','awaiting_mds','to_analyze','accepted_mds','proposed_slot','needs_information','awaiting_client','confirmed','refused','cancelled','planned','en_route','in_progress','completed','invoiced','paid','closed','expired','quote_pending','quote_accepted','quote_refused') NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_appointments` ADD `travelMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_appointments` ADD `bufferMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD `planId` int;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD `purpose` enum('full','deposit','balance') DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD `receivedAmountCents` int;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD `creditedAt` timestamp;--> statement-breakpoint
ALTER TABLE `mds_quotes` ADD `content` json;--> statement-breakpoint
ALTER TABLE `mds_quotes` ADD `amountCents` int;--> statement-breakpoint
ALTER TABLE `mds_quotes` ADD `issuedAt` timestamp;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD `alternatives` json;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD `departedAt` timestamp;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `calendarEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `calendarTimezone` varchar(80) DEFAULT 'Europe/Paris' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `weeklyWindows` json;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `travelZones` json;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `bufferMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `horizonDays` int DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `remindersEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `reminderHours` int DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `proposalReminderHours` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `emailEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `smsEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `publicOrigin` varchar(1000) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `emailFrom` varchar(320) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD `smsFrom` varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_extra_works` ADD CONSTRAINT `mds_extra_works_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_extra_works` ADD CONSTRAINT `mds_extra_works_documentId_mds_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_extra_works` ADD CONSTRAINT `mds_extra_works_acceptedBy_users_id_fk` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_incidents` ADD CONSTRAINT `mds_incidents_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_incidents` ADD CONSTRAINT `mds_incidents_reportedBy_users_id_fk` FOREIGN KEY (`reportedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_incidents` ADD CONSTRAINT `mds_incidents_resolvedBy_users_id_fk` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_message_outbox` ADD CONSTRAINT `mds_message_outbox_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_message_outbox` ADD CONSTRAINT `mds_message_outbox_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_message_outbox` ADD CONSTRAINT `mds_message_outbox_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_payment_plans` ADD CONSTRAINT `mds_payment_plans_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_quote_drafts` ADD CONSTRAINT `mds_quote_drafts_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_quote_drafts` ADD CONSTRAINT `mds_quote_drafts_documentId_mds_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_refunds` ADD CONSTRAINT `mds_refunds_paymentId_mds_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `mds_payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_refunds` ADD CONSTRAINT `mds_refunds_requestedBy_users_id_fk` FOREIGN KEY (`requestedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_reminders` ADD CONSTRAINT `mds_reminders_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;