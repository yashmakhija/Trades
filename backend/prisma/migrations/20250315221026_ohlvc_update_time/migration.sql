/*
  Warnings:

  - You are about to drop the column `timestamp` on the `OHLCV` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Timeframe" AS ENUM ('ONE_MINUTE', 'FIVE_MINUTES', 'TEN_MINUTES', 'FIFTEEN_MINUTES', 'THIRTY_MINUTES', 'ONE_HOUR', 'FOUR_HOURS', 'ONE_DAY');

-- DropIndex
DROP INDEX "OHLCV_timestamp_idx";

-- AlterTable
ALTER TABLE "OHLCV" DROP COLUMN "timestamp",
ADD COLUMN     "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "timeframe" "Timeframe" NOT NULL DEFAULT 'ONE_MINUTE';

-- CreateIndex
CREATE INDEX "OHLCV_symbolId_timeframe_time_idx" ON "OHLCV"("symbolId", "timeframe", "time" DESC);

-- CreateIndex
CREATE INDEX "OHLCV_time_idx" ON "OHLCV"("time" DESC);

-- CreateIndex
CREATE INDEX "OHLCV_timeframe_idx" ON "OHLCV"("timeframe");
