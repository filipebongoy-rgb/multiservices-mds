CREATE TABLE `mds_location_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`artisanUserId` int NOT NULL,
	`latitudeE6` int NOT NULL,
	`longitudeE6` int NOT NULL,
	`accuracyM` int,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_location_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mds_location_updates` ADD CONSTRAINT `mds_location_updates_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_location_updates` ADD CONSTRAINT `mds_location_updates_artisanUserId_users_id_fk` FOREIGN KEY (`artisanUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `location_request_time` ON `mds_location_updates` (`requestId`,`recordedAt`);