/*
  Warnings:

  - You are about to drop the column `avgFillPrice` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `filled` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `remaining` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Position` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_userId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "avgFillPrice",
DROP COLUMN "filled",
DROP COLUMN "remaining",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "pnl" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "balance",
ADD COLUMN     "usdcBalance" INTEGER NOT NULL DEFAULT 1000000;

-- DropTable
DROP TABLE "Position";
