-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE_OPEN', 'TRADE_CLOSE', 'TRADE_CANCEL', 'FUNDING', 'REFERRAL', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reservedAmount" INTEGER;

-- CreateTable
CREATE TABLE "BalanceHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "BalanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceHistory_userId_createdAt_idx" ON "BalanceHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BalanceHistory_orderId_idx" ON "BalanceHistory"("orderId");

-- AddForeignKey
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
