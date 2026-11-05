CREATE TABLE `mds_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`status` enum('confirmed','in_progress','completed','cancelled') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_appointments_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `mds_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artisanUserId` int NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`kind` enum('available','blocked') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`organizationId` int,
	`name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`documentId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`status` enum('indexed','active','ended') NOT NULL DEFAULT 'indexed',
	`startAt` timestamp,
	`endAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_contracts_documentId_unique` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `mds_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`organizationId` int,
	`uploadedBy` int,
	`name` varchar(200) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`kind` enum('photo','quote','invoice','contract','other') NOT NULL,
	`byteSize` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`encryptionKey` varchar(64) NOT NULL,
	`iv` varchar(32) NOT NULL,
	`authTag` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`status` varchar(40) NOT NULL,
	`message` text NOT NULL,
	`actorType` enum('client','artisan','system') NOT NULL,
	`actorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_interventions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_interventions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_interventions_requestId_unique` UNIQUE(`requestId`),
	CONSTRAINT `mds_interventions_appointmentId_unique` UNIQUE(`appointmentId`)
);
--> statement-breakpoint
CREATE TABLE `mds_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('manager','member') NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`invitedBy` int NOT NULL,
	`acceptedBy` int,
	`acceptedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_invitations_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `mds_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`documentId` int NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	`paymentVerifiedBy` int,
	`verificationNote` text,
	CONSTRAINT `mds_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_invoices_requestId_unique` UNIQUE(`requestId`),
	CONSTRAINT `mds_invoices_documentId_unique` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `mds_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','member') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_org_user` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `mds_notification_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_notification_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_read_user` UNIQUE(`notificationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `mds_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`organizationId` int,
	`requestId` int,
	`audience` enum('artisan','client') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('entreprise','syndic','bailleur','gestionnaire','association','collectivite') NOT NULL,
	`ownerUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`documentId` int NOT NULL,
	`status` enum('pending','accepted','refused','superseded') NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_quotes_documentId_unique` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `mds_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(40) NOT NULL,
	`trackingHash` varchar(64) NOT NULL,
	`idempotencyHash` varchar(64) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`userId` int,
	`clientId` int NOT NULL,
	`serviceId` int,
	`serviceName` varchar(120),
	`description` text NOT NULL,
	`problemType` varchar(120) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`address` varchar(250) NOT NULL,
	`postcode` varchar(5) NOT NULL,
	`city` varchar(100) NOT NULL,
	`desiredStart` timestamp,
	`organizationId` int,
	`siteId` int,
	`answers` json NOT NULL,
	`consentAt` timestamp NOT NULL,
	`status` enum('draft','sent','awaiting_mds','to_analyze','accepted_mds','proposed_slot','needs_information','awaiting_client','confirmed','refused','cancelled','planned','in_progress','completed','invoiced','paid','closed','expired','quote_pending','quote_accepted','quote_refused') NOT NULL,
	`version` int NOT NULL DEFAULT 0,
	`proposedStart` timestamp,
	`proposedPriceCents` int,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`proposalMessage` text,
	`expiresAt` timestamp,
	`quoteStatus` enum('none','pending','accepted','refused') NOT NULL DEFAULT 'none',
	`lastAction` varchar(40),
	`lastActionVersion` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_requests_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `mds_requests_idempotencyHash_unique` UNIQUE(`idempotencyHash`)
);
--> statement-breakpoint
CREATE TABLE `mds_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`interventionId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`authorType` enum('artisan','client') NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`moderation` enum('pending','approved','hidden') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_request_role` UNIQUE(`requestId`,`authorType`)
);
--> statement-breakpoint
CREATE TABLE `mds_seed_versions` (
	`version` varchar(100) NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_seed_versions_version` PRIMARY KEY(`version`)
);
--> statement-breakpoint
CREATE TABLE `mds_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seedKey` varchar(150),
	`trade` enum('plomberie','electricite','chauffage','peinture','maintenance') NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`photoUrl` varchar(1000) NOT NULL DEFAULT '',
	`priceCents` int,
	`pricingRule` varchar(500) NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`questions` json NOT NULL,
	`problemTypes` json NOT NULL,
	`conditions` text NOT NULL,
	`zone` varchar(300) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_services_seedKey_unique` UNIQUE(`seedKey`)
);
--> statement-breakpoint
CREATE TABLE `mds_settings` (
	`id` int NOT NULL,
	`zone` varchar(300) NOT NULL DEFAULT '',
	`contactEmail` varchar(320) NOT NULL DEFAULT '',
	`contactPhone` varchar(30) NOT NULL DEFAULT '',
	`businessAddress` varchar(500) NOT NULL DEFAULT '',
	`legalName` varchar(200) NOT NULL DEFAULT '',
	`legalNotice` text NOT NULL,
	`proposalExpiryHours` int NOT NULL DEFAULT 72,
	`artisanUserId` int,
	`activationHash` varchar(64),
	`activationUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`address` varchar(250) NOT NULL,
	`postcode` varchar(5) NOT NULL,
	`city` varchar(100) NOT NULL,
	`contactName` varchar(120) NOT NULL,
	`contactPhone` varchar(30) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mds_tariffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`priceCents` int,
	`rule` text NOT NULL,
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_tariffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mds_appointments` ADD CONSTRAINT `mds_appointments_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_audit` ADD CONSTRAINT `mds_audit_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_availability` ADD CONSTRAINT `mds_availability_artisanUserId_users_id_fk` FOREIGN KEY (`artisanUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_clients` ADD CONSTRAINT `mds_clients_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_clients` ADD CONSTRAINT `mds_clients_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_contracts` ADD CONSTRAINT `mds_contracts_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_contracts` ADD CONSTRAINT `mds_contracts_documentId_mds_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_documents` ADD CONSTRAINT `mds_documents_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_documents` ADD CONSTRAINT `mds_documents_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_documents` ADD CONSTRAINT `mds_documents_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_events` ADD CONSTRAINT `mds_events_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_events` ADD CONSTRAINT `mds_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_interventions` ADD CONSTRAINT `mds_interventions_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_interventions` ADD CONSTRAINT `mds_interventions_appointmentId_mds_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `mds_appointments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invitations` ADD CONSTRAINT `mds_invitations_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invitations` ADD CONSTRAINT `mds_invitations_invitedBy_users_id_fk` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invitations` ADD CONSTRAINT `mds_invitations_acceptedBy_users_id_fk` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invoices` ADD CONSTRAINT `mds_invoices_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invoices` ADD CONSTRAINT `mds_invoices_documentId_mds_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_invoices` ADD CONSTRAINT `mds_invoices_paymentVerifiedBy_users_id_fk` FOREIGN KEY (`paymentVerifiedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_members` ADD CONSTRAINT `mds_members_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_members` ADD CONSTRAINT `mds_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_notification_reads` ADD CONSTRAINT `mds_notification_reads_notificationId_mds_notifications_id_fk` FOREIGN KEY (`notificationId`) REFERENCES `mds_notifications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_notification_reads` ADD CONSTRAINT `mds_notification_reads_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_notifications` ADD CONSTRAINT `mds_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_notifications` ADD CONSTRAINT `mds_notifications_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_notifications` ADD CONSTRAINT `mds_notifications_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_organizations` ADD CONSTRAINT `mds_organizations_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_quotes` ADD CONSTRAINT `mds_quotes_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_quotes` ADD CONSTRAINT `mds_quotes_documentId_mds_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD CONSTRAINT `mds_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD CONSTRAINT `mds_requests_clientId_mds_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `mds_clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD CONSTRAINT `mds_requests_serviceId_mds_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `mds_services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD CONSTRAINT `mds_requests_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD CONSTRAINT `mds_requests_siteId_mds_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `mds_sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_reviews` ADD CONSTRAINT `mds_reviews_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_reviews` ADD CONSTRAINT `mds_reviews_interventionId_mds_interventions_id_fk` FOREIGN KEY (`interventionId`) REFERENCES `mds_interventions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_reviews` ADD CONSTRAINT `mds_reviews_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_settings` ADD CONSTRAINT `mds_settings_artisanUserId_users_id_fk` FOREIGN KEY (`artisanUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_sites` ADD CONSTRAINT `mds_sites_organizationId_mds_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `mds_organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_tariffs` ADD CONSTRAINT `mds_tariffs_serviceId_mds_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `mds_services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointments_start` ON `mds_appointments` (`startAt`);--> statement-breakpoint
CREATE INDEX `requests_org` ON `mds_requests` (`organizationId`);--> statement-breakpoint
CREATE INDEX `requests_user` ON `mds_requests` (`userId`);--> statement-breakpoint
CREATE INDEX `requests_status` ON `mds_requests` (`status`);