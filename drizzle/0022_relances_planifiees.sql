ALTER TABLE `mds_assistant_actions` MODIFY COLUMN `status` enum('proposed','approved','sent','failed','cancelled','scheduled') NOT NULL DEFAULT 'proposed';--> statement-breakpoint
ALTER TABLE `mds_assistant_actions` ADD `scheduledFor` timestamp;--> statement-breakpoint
CREATE INDEX `assistant_actions_due` ON `mds_assistant_actions` (`status`,`scheduledFor`);