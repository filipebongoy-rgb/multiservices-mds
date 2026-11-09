CREATE TABLE `mds_artisan_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`assignedBy` int,
	`status` enum('assigned','completed','cancelled') NOT NULL DEFAULT 'assigned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_artisan_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `artisan_assignment_request` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `mds_artisan_team` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(200) NOT NULL,
	`role` enum('technician','assistant') NOT NULL DEFAULT 'technician',
	`status` enum('pending','active','revoked') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_artisan_team_id` PRIMARY KEY(`id`),
	CONSTRAINT `artisan_team_owner_email` UNIQUE(`ownerUserId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `mds_artisan_assignments` ADD CONSTRAINT `mds_artisan_assignments_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_artisan_assignments` ADD CONSTRAINT `mds_artisan_assignments_teamMemberId_mds_artisan_team_id_fk` FOREIGN KEY (`teamMemberId`) REFERENCES `mds_artisan_team`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_artisan_assignments` ADD CONSTRAINT `mds_artisan_assignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_artisan_team` ADD CONSTRAINT `mds_artisan_team_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_artisan_team` ADD CONSTRAINT `mds_artisan_team_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;