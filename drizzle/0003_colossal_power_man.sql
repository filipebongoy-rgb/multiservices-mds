CREATE TABLE `mds_payment_events` (
	`eventId` varchar(255) NOT NULL,
	`provider` varchar(30) NOT NULL,
	`mode` enum('test','live') NOT NULL,
	`type` varchar(100) NOT NULL,
	`paymentId` int,
	`outcome` varchar(100) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_payment_events_eventId` PRIMARY KEY(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `mds_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`provider` enum('stripe','manual') NOT NULL,
	`mode` enum('test','live','offline') NOT NULL,
	`status` enum('pending','succeeded','failed','expired','cancelled') NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`checkoutSessionId` varchar(255),
	`paymentIntentId` varchar(255),
	`checkoutKey` varchar(100),
	`reference` varchar(255),
	`verifiedBy` int,
	`verificationNote` text,
	`expiresAt` timestamp,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_payments_checkoutSessionId_unique` UNIQUE(`checkoutSessionId`),
	CONSTRAINT `mds_payments_paymentIntentId_unique` UNIQUE(`paymentIntentId`),
	CONSTRAINT `mds_payments_checkoutKey_unique` UNIQUE(`checkoutKey`)
);
--> statement-breakpoint
ALTER TABLE `mds_invoices` ADD `amountCents` int;--> statement-breakpoint
ALTER TABLE `mds_invoices` ADD `currency` varchar(3) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_requests` ADD `pricingSnapshot` json;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `pricingMode` enum('fixed','quote') DEFAULT 'quote' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `pricingVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `included` text;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `excluded` text;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `travelMode` enum('unconfigured','included','fixed','postcode') DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `travelFeeCents` int;--> statement-breakpoint
ALTER TABLE `mds_services` ADD `travelRules` json;--> statement-breakpoint
ALTER TABLE `mds_tariffs` ADD `configuration` json;--> statement-breakpoint
ALTER TABLE `mds_payment_events` ADD CONSTRAINT `mds_payment_events_paymentId_mds_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `mds_payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD CONSTRAINT `mds_payments_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD CONSTRAINT `mds_payments_invoiceId_mds_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `mds_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD CONSTRAINT `mds_payments_verifiedBy_users_id_fk` FOREIGN KEY (`verifiedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_request` ON `mds_payments` (`requestId`);--> statement-breakpoint
CREATE INDEX `payments_invoice` ON `mds_payments` (`invoiceId`);--> statement-breakpoint
-- Preserve legacy configured prices without inventing travel fees or activating offers.
UPDATE `mds_services` SET `pricingMode` = 'fixed' WHERE `priceCents` IS NOT NULL;
