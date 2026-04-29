DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountRole') THEN
    CREATE TYPE "AccountRole" AS ENUM ('CLIENT', 'ADMIN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MailTemplateChannel') THEN
    CREATE TYPE "MailTemplateChannel" AS ENUM ('EMAIL', 'SMS');
  END IF;
END $$;

ALTER TABLE "accounts"
ADD COLUMN IF NOT EXISTS "role" "AccountRole" NOT NULL DEFAULT 'CLIENT';

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accountId" INTEGER,
  "agenceVoyageId" INTEGER,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_accountId_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_agenceVoyageId_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_agenceVoyageId_fkey"
    FOREIGN KEY ("agenceVoyageId") REFERENCES "agences_voyage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_expiresAt_idx" ON "password_reset_tokens"("email", "expiresAt");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_accountId_idx" ON "password_reset_tokens"("accountId");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_agenceVoyageId_idx" ON "password_reset_tokens"("agenceVoyageId");

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_templates_slug_key" ON "mail_templates"("slug");
