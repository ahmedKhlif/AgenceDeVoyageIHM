ALTER TABLE "accounts"
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_stripeCustomerId_key"
ON "accounts"("stripeCustomerId");

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "stripePaymentMethodId" TEXT,
  "stripeCustomerId" TEXT,
  "stripeSetupIntentId" TEXT,
  "cardholderName" TEXT,
  "brand" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "expiryMonth" INTEGER NOT NULL,
  "expiryYear" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_methods_accountId_fkey'
  ) THEN
    ALTER TABLE "payment_methods"
    ADD CONSTRAINT "payment_methods_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_stripePaymentMethodId_key"
ON "payment_methods"("stripePaymentMethodId");

CREATE INDEX IF NOT EXISTS "payment_methods_accountId_idx"
ON "payment_methods"("accountId");

CREATE INDEX IF NOT EXISTS "payment_methods_accountId_isDefault_idx"
ON "payment_methods"("accountId", "isDefault");
