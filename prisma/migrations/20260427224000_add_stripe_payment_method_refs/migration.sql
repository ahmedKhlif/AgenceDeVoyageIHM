-- AlterTable
ALTER TABLE "accounts"
ADD COLUMN "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "payment_methods"
ADD COLUMN "stripePaymentMethodId" TEXT,
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSetupIntentId" TEXT,
ALTER COLUMN "cardholderName" DROP NOT NULL;

-- Backfill for existing records to satisfy new required columns
UPDATE "payment_methods"
SET
  "stripePaymentMethodId" = CONCAT('legacy_pm_', "id"),
  "stripeCustomerId" = CONCAT('legacy_customer_', "accountId")
WHERE "stripePaymentMethodId" IS NULL OR "stripeCustomerId" IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE "payment_methods"
ALTER COLUMN "stripePaymentMethodId" SET NOT NULL,
ALTER COLUMN "stripeCustomerId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_stripeCustomerId_key" ON "accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_stripePaymentMethodId_key" ON "payment_methods"("stripePaymentMethodId");
