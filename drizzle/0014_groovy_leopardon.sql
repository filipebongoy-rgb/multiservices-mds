CREATE TABLE `mds_admin_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','active','revoked') NOT NULL DEFAULT 'active',
	`invitedBy` int,
	`acceptedBy` int,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_admin_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_admin_invites_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `mds_admin_invites` ADD CONSTRAINT `mds_admin_invites_invitedBy_users_id_fk` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_admin_invites` ADD CONSTRAINT `mds_admin_invites_acceptedBy_users_id_fk` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
INSERT IGNORE INTO `mds_admin_invites` (`email`, `status`) VALUES
  ('multiservicesmds2026@gmail.com', 'active'),
  ('filipe.bongoy@gmail.com', 'active');
