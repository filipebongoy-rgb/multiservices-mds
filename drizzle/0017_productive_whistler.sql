CREATE TABLE `mds_local_password_resets` (
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_local_password_resets_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `mds_local_password_resets` ADD CONSTRAINT `mds_local_password_resets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `local_password_resets_user_idx` ON `mds_local_password_resets` (`userId`);