/*
  Warnings:

  - You are about to drop the column `target` on the `Order` table. All the data in the column will be lost.
  - Added the required column `remaining` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'FILLED';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "target",
ADD COLUMN     "avgFillPrice" INTEGER,
ADD COLUMN     "filled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isShort" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentOrderId" TEXT,
ADD COLUMN     "remaining" INTEGER NOT NULL,
ADD COLUMN     "takeProfit" INTEGER;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "avgPrice" INTEGER NOT NULL,
    "isShort" BOOLEAN NOT NULL DEFAULT false,
    "unrealizedPnL" INTEGER NOT NULL DEFAULT 0,
    "realizedPnL" INTEGER NOT NULL DEFAULT 0,
    "stopLoss" INTEGER,
    "takeProfit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OHLCV" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "open" INTEGER NOT NULL,
    "high" INTEGER NOT NULL,
    "low" INTEGER NOT NULL,
    "close" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OHLCV_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "Position"("symbol");

-- CreateIndex
CREATE INDEX "OHLCV_timestamp_idx" ON "OHLCV"("timestamp");

-- CreateIndex
CREATE INDEX "OHLCV_symbolId_idx" ON "OHLCV"("symbolId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_symbolId_idx" ON "Order"("symbolId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OHLCV" ADD CONSTRAINT "OHLCV_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
