CREATE TABLE `mds_assistant_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`createdBy` int NOT NULL,
	`actionType` enum('follow_up','quote_review','invoice_review','appointment_confirmation','call_script') NOT NULL,
	`channel` enum('email','sms','call') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`status` enum('proposed','approved','sent','failed','cancelled') NOT NULL DEFAULT 'proposed',
	`dedupeKey` varchar(180) NOT NULL,
	`lastError` varchar(500),
	`approvedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_assistant_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_assistant_actions_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `mds_assistant_actions` ADD CONSTRAINT `mds_assistant_actions_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mds_assistant_actions` ADD CONSTRAINT `mds_assistant_actions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assistant_actions_request` ON `mds_assistant_actions` (`requestId`);--> statement-breakpoint
CREATE INDEX `assistant_actions_status` ON `mds_assistant_actions` (`status`);