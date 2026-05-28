CREATE TABLE `analyticsSettings` (
  `id` text PRIMARY KEY NOT NULL,
  `targetMarginBps` integer DEFAULT 3500 NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `analyticsSettings` (`id`, `targetMarginBps`, `createdAt`, `updatedAt`)
VALUES ('default', 3500, 0, 0)
ON CONFLICT(`id`) DO NOTHING;
