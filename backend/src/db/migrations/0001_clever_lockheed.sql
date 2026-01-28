CREATE TABLE `point_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`reference_id` integer,
	`reference_type` text,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_sustainability_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_items_consumed` integer DEFAULT 0 NOT NULL,
	`total_items_wasted` integer DEFAULT 0 NOT NULL,
	`total_items_shared` integer DEFAULT 0 NOT NULL,
	`total_items_sold` integer DEFAULT 0 NOT NULL,
	`estimated_money_saved` real DEFAULT 0 NOT NULL,
	`estimated_co2_saved` real DEFAULT 0 NOT NULL,
	`waste_reduction_rate` real DEFAULT 100 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`available_points` integer DEFAULT 0 NOT NULL,
	`lifetime_points` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_activity_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE products ADD `expiry_date` integer;--> statement-breakpoint
ALTER TABLE products ADD `unit` text;--> statement-breakpoint
ALTER TABLE products ADD `storage_location` text;--> statement-breakpoint
ALTER TABLE products ADD `notes` text;--> statement-breakpoint
ALTER TABLE products ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE products ADD `consumed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `product_sustainability_metrics_user_id_unique` ON `product_sustainability_metrics` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_points_user_id_unique` ON `user_points` (`user_id`);