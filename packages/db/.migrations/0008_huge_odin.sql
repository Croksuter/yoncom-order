CREATE TABLE `firstOrderRules` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`requiredCount` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `firstOrderRuleMenuCounts` (
	`ruleId` text NOT NULL,
	`menuId` text NOT NULL,
	`countAs` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`ruleId`, `menuId`),
	FOREIGN KEY (`ruleId`) REFERENCES `firstOrderRules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menuId`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menuBundleItems` (
	`bundleMenuId` text NOT NULL,
	`componentMenuId` text NOT NULL,
	`quantity` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`bundleMenuId`, `componentMenuId`),
	FOREIGN KEY (`bundleMenuId`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`componentMenuId`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
