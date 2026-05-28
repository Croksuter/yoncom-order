ALTER TABLE `menuOrders` ADD `readyQuantity` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `menuOrders` ADD `pickedUpQuantity` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `menuOrders` SET `readyQuantity` = `quantity` WHERE `status` = 'READY';
--> statement-breakpoint
UPDATE `menuOrders` SET `pickedUpQuantity` = `quantity` WHERE `status` IN ('PICKED_UP', 'SERVED');
