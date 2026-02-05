-- Add rewards table
CREATE TABLE IF NOT EXISTS `rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`category` text NOT NULL,
	`points_cost` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Add user_redemptions table
CREATE TABLE IF NOT EXISTS `user_redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`reward_id` integer NOT NULL,
	`points_spent` integer NOT NULL,
	`redemption_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`collected_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Add unique index on redemption_code
CREATE UNIQUE INDEX IF NOT EXISTS `user_redemptions_redemption_code_unique` ON `user_redemptions` (`redemption_code`);
