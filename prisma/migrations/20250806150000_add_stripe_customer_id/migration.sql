ALTER TABLE `User` ADD COLUMN `stripeCustomerId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_stripeCustomerId_key` ON `User`(`stripeCustomerId`);