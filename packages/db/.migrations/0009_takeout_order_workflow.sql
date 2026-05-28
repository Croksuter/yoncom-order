ALTER TABLE `tables` ADD `isTakeout` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `tables` ADD `takeoutFirstOrderRuleEnabled` integer DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE `orderWorkflowSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`autoPickUpOnCookComplete` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
