CREATE TABLE `cafe_workspaces` (`id` int NOT NULL AUTO_INCREMENT,`workspaceKey` varchar(32) NOT NULL DEFAULT 'drip',`businessName` varchar(200) NOT NULL,`branchName` varchar(200) NOT NULL,`currency` varchar(3) NOT NULL,`ownerUserId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_workspace_owner_uq` (`ownerUserId`),UNIQUE KEY `cafe_workspace_key_uq` (`workspaceKey`));
--> statement-breakpoint
CREATE TABLE `cafe_roles` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(100) NOT NULL,`isSystem` boolean NOT NULL DEFAULT false,`isOwner` boolean NOT NULL DEFAULT false,`permissions` json NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_accounts` (`id` int NOT NULL AUTO_INCREMENT,`userId` int NOT NULL,`roleId` int NULL,`active` boolean NOT NULL DEFAULT false,`lastAuditedLoginAt` timestamp NULL,`lastSeenAt` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_accounts_user_uq` (`userId`));
--> statement-breakpoint
CREATE TABLE `cafe_locations` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(200) NOT NULL,`type` enum('warehouse','cafe','event') NOT NULL,`warehouseId` int NULL,`eventId` int NULL,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_warehouses` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(200) NOT NULL,`location` varchar(500) NOT NULL,`active` boolean NOT NULL DEFAULT true,`locationId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_products` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(200) NOT NULL,`sku` varchar(100) NOT NULL,`category` varchar(100) NOT NULL,`price` decimal(12,2) NOT NULL,`unit` varchar(40) NOT NULL,`lowStockThreshold` decimal(12,3) NOT NULL,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_products_sku_uq` (`sku`));
--> statement-breakpoint
CREATE TABLE `cafe_suppliers` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(200) NOT NULL,`contactName` varchar(200),`email` varchar(320),`phone` varchar(60),`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_events` (`id` int NOT NULL AUTO_INCREMENT,`name` varchar(200) NOT NULL,`location` varchar(500) NOT NULL,`startDate` timestamp NOT NULL,`endDate` timestamp NULL,`status` enum('open','closed') NOT NULL DEFAULT 'open',`locationId` int NOT NULL,`actorId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_stock` (`id` int NOT NULL AUTO_INCREMENT,`locationId` int NOT NULL,`productId` int NOT NULL,`quantity` decimal(14,3) NOT NULL DEFAULT 0,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_stock_location_product_uq` (`locationId`,`productId`));
--> statement-breakpoint
CREATE TABLE `cafe_receivings` (`id` int NOT NULL AUTO_INCREMENT,`reference` varchar(120) NOT NULL,`supplierId` int NULL,`warehouseId` int NOT NULL,`total` decimal(14,2) NOT NULL,`note` text,`actorId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_receiving_lines` (`id` int NOT NULL AUTO_INCREMENT,`receivingId` int NOT NULL,`productId` int NOT NULL,`quantity` decimal(14,3) NOT NULL,`unitCost` decimal(14,2) NOT NULL,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_sales` (`id` int NOT NULL AUTO_INCREMENT,`invoiceNo` varchar(80) NOT NULL,`source` enum('cafe','event') NOT NULL,`eventId` int NULL,`actorId` int NOT NULL,`total` decimal(14,2) NOT NULL,`paymentMethod` enum('cash','terminal','other') NOT NULL,`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_sales_invoice_uq` (`invoiceNo`));
--> statement-breakpoint
CREATE TABLE `cafe_sale_lines` (`id` int NOT NULL AUTO_INCREMENT,`saleId` int NOT NULL,`productId` int NOT NULL,`name` varchar(200) NOT NULL,`quantity` decimal(14,3) NOT NULL,`unitPrice` decimal(14,2) NOT NULL,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_payments` (`id` int NOT NULL AUTO_INCREMENT,`saleId` int NOT NULL,`provider` varchar(100) NOT NULL,`providerReference` varchar(200) NOT NULL,`amount` decimal(14,2) NOT NULL,`status` enum('pending','paid','failed','refunded') NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`),UNIQUE KEY `cafe_payment_provider_reference_uq` (`provider`,`providerReference`));
--> statement-breakpoint
CREATE TABLE `cafe_stock_movements` (`id` int NOT NULL AUTO_INCREMENT,`productId` int NOT NULL,`quantity` decimal(14,3) NOT NULL,`fromLocationId` int NULL,`toLocationId` int NULL,`reason` varchar(255) NOT NULL,`actorId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`referenceType` varchar(40),`referenceId` int NULL,PRIMARY KEY (`id`),KEY `cafe_stock_movement_product_idx` (`productId`));
--> statement-breakpoint
CREATE TABLE `cafe_corrections` (`id` int NOT NULL AUTO_INCREMENT,`saleId` int NOT NULL,`reason` text NOT NULL,`beforeData` json NOT NULL,`afterData` json NOT NULL,`actorId` int NOT NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`));
--> statement-breakpoint
CREATE TABLE `cafe_audit` (`id` int NOT NULL AUTO_INCREMENT,`actorId` int NOT NULL,`action` varchar(100) NOT NULL,`entity` varchar(100) NOT NULL,`entityId` int NULL,`summary` text NOT NULL,`beforeData` json NULL,`afterData` json NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`),KEY `cafe_audit_created_idx` (`createdAt`));
