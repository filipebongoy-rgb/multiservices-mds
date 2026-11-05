ALTER TABLE `mds_documents` ADD `photoAuthor` enum('client','artisan','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_documents` ADD `description` varchar(500);