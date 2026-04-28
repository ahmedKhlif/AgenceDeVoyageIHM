-- DropForeignKey
ALTER TABLE "avis" DROP CONSTRAINT "avis_reservationId_fkey";

-- AlterTable
ALTER TABLE "avis"
ADD COLUMN "accountId" INTEGER,
ADD COLUMN "authorName" TEXT,
ADD COLUMN "hotelId" INTEGER,
ALTER COLUMN "reservationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "offres" ADD COLUMN "photo" TEXT;

-- AlterTable
ALTER TABLE "profiles"
ADD COLUMN "bio" TEXT,
ADD COLUMN "dateNaissance" TIMESTAMP(3),
ADD COLUMN "destinationsPreferees" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "numeroPasseport" TEXT,
ADD COLUMN "preferencesVoyage" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
