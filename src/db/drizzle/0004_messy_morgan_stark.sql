ALTER TABLE `settings` ADD `drive_connected_email` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `drive_auto_backup_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `drive_backup_interval_days` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `drive_last_backup_at` text;