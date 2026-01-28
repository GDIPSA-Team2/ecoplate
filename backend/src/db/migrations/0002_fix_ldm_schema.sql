-- Migration to fix schema per LDM
-- Removes point_transactions and product_sustainability_metrics
-- Adds product_interaction table per LDM
-- Simplifies user_points to match LDM

-- Drop tables that are not in LDM
DROP TABLE IF EXISTS `point_transactions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `product_sustainability_metrics`;
--> statement-breakpoint

-- Create product_interaction table per LDM
CREATE TABLE IF NOT EXISTS `product_interaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`today_date` integer NOT NULL,
	`quantity` real NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create simplified user_points if not exists (matches LDM: id, userId, total_points, current_streak)
CREATE TABLE IF NOT EXISTS `user_points_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL UNIQUE,
	`total_points` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Migrate data from old user_points to new
INSERT OR IGNORE INTO `user_points_new` (`id`, `user_id`, `total_points`, `current_streak`)
SELECT `id`, `user_id`, `total_points`, `current_streak` FROM `user_points`;
--> statement-breakpoint

-- Drop old user_points and rename new one
DROP TABLE IF EXISTS `user_points`;
--> statement-breakpoint

ALTER TABLE `user_points_new` RENAME TO `user_points`;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `user_points_user_id_unique` ON `user_points` (`user_id`);
