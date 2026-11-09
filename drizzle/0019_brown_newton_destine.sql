CREATE TABLE `mds_voice_call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callSid` varchar(120) NOT NULL,
	`fromNumber` varchar(30),
	`toNumber` varchar(30),
	`direction` enum('inbound','outbound') NOT NULL,
	`status` enum('received','in_progress','completed','failed') NOT NULL DEFAULT 'received',
	`requestId` int,
	`transcript` text,
	`summary` text,
	`lastError` varchar(500),
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mds_voice_call_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mds_voice_call_logs_callSid_unique` UNIQUE(`callSid`)
);
--> statement-breakpoint
ALTER TABLE `mds_voice_call_logs` ADD CONSTRAINT `mds_voice_call_logs_requestId_mds_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `mds_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `voice_call_logs_status` ON `mds_voice_call_logs` (`status`);--> statement-breakpoint
CREATE INDEX `voice_call_logs_request` ON `mds_voice_call_logs` (`requestId`);