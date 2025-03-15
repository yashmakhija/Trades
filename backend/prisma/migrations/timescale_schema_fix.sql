-- Migration to modify the OHLCV table schema for TimescaleDB compatibility
-- This script modifies the primary key to include the 'time' column

-- First, drop the existing primary key constraint
ALTER TABLE "OHLCV" DROP CONSTRAINT "OHLCV_pkey";

-- Add a new composite primary key that includes the time column
ALTER TABLE "OHLCV" ADD PRIMARY KEY ("id", "time");

-- Now the table can be converted to a hypertable
-- Note: Run the setup-timescaledb.js script after applying this migration 