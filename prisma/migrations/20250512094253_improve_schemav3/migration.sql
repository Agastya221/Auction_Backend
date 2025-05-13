/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Bid` table. All the data in the column will be lost.
  - Added the required column `creatorId` to the `Auction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Auction" DROP CONSTRAINT "Auction_topBidderId_fkey";

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "creatorId" TEXT NOT NULL,
ALTER COLUMN "topBid" SET DEFAULT 0,
ALTER COLUMN "topBidderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Bid" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Auction_topBidderId_idx" ON "Auction"("topBidderId");

-- CreateIndex
CREATE INDEX "Auction_creatorId_idx" ON "Auction"("creatorId");

-- CreateIndex
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_topBidderId_fkey" FOREIGN KEY ("topBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
