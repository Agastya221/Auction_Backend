/*
  Warnings:

  - You are about to drop the column `endtime` on the `Auction` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `Auction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "endtime",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL;
