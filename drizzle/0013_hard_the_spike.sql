CREATE TABLE `mds_waitlist_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`reason` enum('no_slot','client_preference','capacity') NOT NULL DEFAULT 'no_slot',
	`status` enum('waiting','contacted','converted','cancelled') NOT NULL DEFAULT 'waiting',
	`requestedStart` timestamp,
	`contactedAt` timestamp,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_waitlist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_waitlist_entries_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
ALTER TABLE `mds_waitlist_entries` ADD CONSTRAINT `mds_waitlist_entries_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `waitlist_status_created` ON `mds_waitlist_entries` (`status`,`createdAt`);