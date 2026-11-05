ALTER TABLE `mds_documents` MODIFY COLUMN `kind` enum('photo','quote','invoice','contract','other','signature') NOT NULL;--> statement-breakpoint
ALTER TABLE `mds_interventions` ADD `clientSignedAt` timestamp;--> statement-breakpoint
ALTER TABLE `mds_interventions` ADD `clientSignatureDocumentId` int;--> statement-breakpoint
ALTER TABLE `mds_payments` ADD `failureReason` text;--> statement-breakpoint
ALTER TABLE `mds_interventions` ADD CONSTRAINT `mds_interventions_clientSignatureDocumentId_mds_documents_id_fk` FOREIGN KEY (`clientSignatureDocumentId`) REFERENCES `mds_documents`(`id`) ON DELETE no action ON UPDATE no action;