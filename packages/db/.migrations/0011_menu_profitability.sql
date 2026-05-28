ALTER TABLE `menus` ADD `unitCost` integer;
--> statement-breakpoint
ALTER TABLE `menus` ADD `targetMarginBps` integer DEFAULT 3500 NOT NULL;
