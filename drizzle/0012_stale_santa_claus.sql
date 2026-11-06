CREATE TABLE `mds_local_credentials` (
	`userId` int NOT NULL,
	`passwordHash` varchar(128) NOT NULL,
	`passwordSalt` varchar(64) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_local_credentials_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `mds_local_sessions` (
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_local_sessions_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `localLoginKey` varchar(180);--> statement-breakpoint
ALTER TABLE `users` ADD `accountType` enum('particular','professional') DEFAULT 'particular' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_localLoginKey_unique` UNIQUE(`localLoginKey`);--> statement-breakpoint
ALTER TABLE `mds_local_credentials` ADD CONSTRAINT `mds_local_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_local_sessions` ADD CONSTRAINT `mds_local_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `local_sessions_user_idx` ON `mds_local_sessions` (`userId`);