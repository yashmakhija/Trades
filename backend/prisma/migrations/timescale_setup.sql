-- TimescaleDB setup for OHLCV table
-- This script should be run after the Prisma migration that creates the OHLCV table

-- Enable TimescaleDB extension if not already enabled
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert the OHLCV table to a hypertable partitioned by time
SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbolid_time_timeframe ON "OHLCV" ("symbolId", time, timeframe);
CREATE INDEX IF NOT EXISTS idx_ohlcv_timeframe ON "OHLCV" (timeframe);

-- Create a continuous aggregate view for 5-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m
WITH (timescaledb.continuous) AS
SELECT
  "symbolId",
  time_bucket('5 minutes', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY "symbolId", bucket;

-- Create a continuous aggregate view for 15-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_15m
WITH (timescaledb.continuous) AS
SELECT
  "symbolId",
  time_bucket('15 minutes', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY "symbolId", bucket;

-- Create a continuous aggregate view for 1-hour candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h
WITH (timescaledb.continuous) AS
SELECT
  "symbolId",
  time_bucket('1 hour', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY "symbolId", bucket;

-- Create a continuous aggregate view for 1-day candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1d
WITH (timescaledb.continuous) AS
SELECT
  "symbolId",
  time_bucket('1 day', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY "symbolId", bucket;

-- Set up a retention policy to keep only the last 7 days of 1-minute data
SELECT add_retention_policy('"OHLCV"', INTERVAL '7 days', if_not_exists => TRUE);

-- Set up refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('candles_5m',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('candles_15m',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('candles_1h',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('candles_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW candles_5m IS 'Pre-computed 5-minute candles from 1-minute data';
COMMENT ON MATERIALIZED VIEW candles_15m IS 'Pre-computed 15-minute candles from 1-minute data';
COMMENT ON MATERIALIZED VIEW candles_1h IS 'Pre-computed 1-hour candles from 1-minute data';
COMMENT ON MATERIALIZED VIEW candles_1d IS 'Pre-computed 1-day candles from 1-minute data'; 