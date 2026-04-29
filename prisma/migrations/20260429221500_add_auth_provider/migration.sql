CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');
ALTER TABLE "accounts" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
