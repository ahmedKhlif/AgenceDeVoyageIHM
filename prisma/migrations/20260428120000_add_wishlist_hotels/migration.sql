-- CreateTable
CREATE TABLE "wishlist_hotels" (
    "accountId" INTEGER NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_hotels_pkey" PRIMARY KEY ("accountId","hotelId")
);

-- CreateIndex
CREATE INDEX "wishlist_hotels_accountId_idx" ON "wishlist_hotels"("accountId");

-- CreateIndex
CREATE INDEX "wishlist_hotels_hotelId_idx" ON "wishlist_hotels"("hotelId");

-- AddForeignKey
ALTER TABLE "wishlist_hotels" ADD CONSTRAINT "wishlist_hotels_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_hotels" ADD CONSTRAINT "wishlist_hotels_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
