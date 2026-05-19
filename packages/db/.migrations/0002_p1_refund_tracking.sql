ALTER TABLE `orders` ADD `cancelReason` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledAt` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledByUserId` text REFERENCES `users`(`id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `refundAmount` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundRequestedAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundedAt` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundHandledByUserId` text REFERENCES `users`(`id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `refundNote` text;--> statement-breakpoint
UPDATE `payments`
SET `status` = 'PAID'
WHERE `paid` = 1 AND (`status` IS NULL OR `status` = 'PENDING');--> statement-breakpoint
UPDATE `payments`
SET `status` = 'PENDING'
WHERE `paid` = 0 AND `status` IS NULL;
