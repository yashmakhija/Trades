/*
  Warnings:

  - The primary key for the `OHLCV` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "OHLCV" DROP CONSTRAINT "OHLCV_pkey",
ADD CONSTRAINT "OHLCV_pkey" PRIMARY KEY ("id", "time");
