-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "notificationsPromotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationsReservation" BOOLEAN NOT NULL DEFAULT true;
