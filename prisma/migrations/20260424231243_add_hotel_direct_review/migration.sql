-- DropForeignKey
ALTER TABLE "avis" DROP CONSTRAINT "avis_reservationId_fkey";

-- AlterTable
ALTER TABLE "avis" ADD COLUMN     "hotelId" INTEGER,
ALTER COLUMN "reservationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "offres" ADD COLUMN     "photo" TEXT;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis" ADD CONSTRAINT "avis_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
