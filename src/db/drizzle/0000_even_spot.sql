CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`diff` text,
	`actor` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`photo_uri` text,
	`address` text,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`direction` text NOT NULL,
	`type` text NOT NULL,
	`entry_date` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`attachment_uri` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`item_name` text NOT NULL,
	`size` text,
	`color` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`rate` integer NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`description_touched` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text,
	`logo_uri` text,
	`currency_symbol` text DEFAULT 'Rs' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`pin_hash` text,
	`biometric_enabled` integer DEFAULT false NOT NULL,
	`bill_footer_text` text
);
