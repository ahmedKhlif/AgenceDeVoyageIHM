-- Align the database with fields already present in prisma/schema.prisma.
-- These statements are defensive so local databases with partial manual fixes can still migrate.

DO $$
BEGIN
  CREATE TYPE "AccountRole" AS ENUM ('CLIENT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MailTemplateChannel" AS ENUM ('EMAIL', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "role" "AccountRole" NOT NULL DEFAULT 'CLIENT';

ALTER TABLE "hotels"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "reservations_stripePaymentIntentId_key"
  ON "reservations"("stripePaymentIntentId");

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accountId" INTEGER,
  "agenceVoyageId" INTEGER,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "password_reset_tokens_agenceVoyageId_fkey" FOREIGN KEY ("agenceVoyageId") REFERENCES "agences_voyage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key"
  ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_expiresAt_idx"
  ON "password_reset_tokens"("email", "expiresAt");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_accountId_idx"
  ON "password_reset_tokens"("accountId");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_agenceVoyageId_idx"
  ON "password_reset_tokens"("agenceVoyageId");

CREATE TABLE IF NOT EXISTS "mail_templates" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "trigger" TEXT NOT NULL,
  "channel" "MailTemplateChannel" NOT NULL DEFAULT 'EMAIL',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "recipients" TEXT,
  "type" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_templates_slug_key"
  ON "mail_templates"("slug");
