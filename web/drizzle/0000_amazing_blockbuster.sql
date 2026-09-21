CREATE TABLE `attempts` (
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`bank` text NOT NULL,
	`correct` integer NOT NULL,
	`answered` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_once` ON `attempts` (`session_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `attempts_progress` ON `attempts` (`user_id`,`bank`,`question_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `members_status` ON `members` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank` text NOT NULL,
	`question_ids` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`score` integer,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_time` ON `sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_bank` ON `sessions` (`user_id`,`bank`) WHERE "sessions"."submitted_at" is null;