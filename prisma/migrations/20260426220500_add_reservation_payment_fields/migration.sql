-- Add Stripe payment metadata to reservations
ALTER TABLE "reservations"
ADD COLUMN "stripeSessionId" TEXT,
ADD COLUMN "paymentDate" TIMESTAMP(3);

CREATE UNIQUE INDEX "reservations_stripeSessionId_key"
ON "reservations"("stripeSessionId");
