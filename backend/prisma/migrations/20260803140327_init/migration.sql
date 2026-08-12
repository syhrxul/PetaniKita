-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `role` ENUM('PETANI', 'UMKM') NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_phone_number_key`(`phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `farm_crops` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `crop_type` VARCHAR(191) NOT NULL,
    `area_size_m2` DOUBLE NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `crop_id` INTEGER NOT NULL,
    `est_harvest_date` DATETIME(3) NOT NULL,
    `est_yield_kg` DOUBLE NOT NULL,
    `status` ENUM('AVAILABLE', 'LOCKED', 'SOLD') NOT NULL DEFAULT 'AVAILABLE',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `umkm_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `umkm_user_id` INTEGER NOT NULL,
    `total_amount` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sender_phone` VARCHAR(191) NOT NULL,
    `message_payload` TEXT NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `farm_crops` ADD CONSTRAINT `farm_crops_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `harvest_events` ADD CONSTRAINT `harvest_events_crop_id_fkey` FOREIGN KEY (`crop_id`) REFERENCES `farm_crops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `umkm_orders` ADD CONSTRAINT `umkm_orders_umkm_user_id_fkey` FOREIGN KEY (`umkm_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
