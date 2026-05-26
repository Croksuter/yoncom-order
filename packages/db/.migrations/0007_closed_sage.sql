CREATE TABLE `uploadedImages` (
	`id` text PRIMARY KEY NOT NULL,
	`originalName` text NOT NULL,
	`contentType` text NOT NULL,
	`extension` text NOT NULL,
	`byteSize` integer NOT NULL,
	`base64Size` integer NOT NULL,
	`chunkCount` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploadedImageChunks` (
	`imageId` text NOT NULL,
	`chunkIndex` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`imageId`, `chunkIndex`),
	FOREIGN KEY (`imageId`) REFERENCES `uploadedImages`(`id`) ON UPDATE no action ON DELETE cascade
);
