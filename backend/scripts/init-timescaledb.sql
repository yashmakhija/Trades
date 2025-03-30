-- Create TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- After Prisma has created the tables, convert OHLCV to a hypertable
SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE, migrate_data => TRUE);

-- Create appropriate indexes for TimescaleDB to work efficiently
CREATE INDEX IF NOT EXISTS "idx_ohlcv_symbol_time" ON "OHLCV" ("symbolId", "time" DESC);
CREATE INDEX IF NOT EXISTS "idx_ohlcv_timeframe_time" ON "OHLCV" ("timeframe", "time" DESC);
CREATE INDEX IF NOT EXISTS "idx_ohlcv_time" ON "OHLCV" ("time" DESC);

-- Configure optimized chunk sizes based on timeframe
-- For 1-minute data, we use 1-day chunks (1440 records per chunk)
SELECT set_chunk_time_interval('"OHLCV"', INTERVAL '1 day');

-- Add compression policy to automatically compress older data
-- This dramatically reduces storage requirements while maintaining query performance
SELECT add_compression_policy('"OHLCV"', INTERVAL '7 days');

-- Configure compression settings to optimize compression ratio
ALTER TABLE "OHLCV" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"symbolId", "timeframe"',
  timescaledb.compress_orderby = 'time DESC'
);

-- Create continuous aggregates for common timeframes
-- These automatically pre-compute aggregated views to dramatically speed up queries
-- 5-minute continuous aggregate
CREATE MATERIALIZED VIEW continuous_aggregate_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  "symbolId",
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY bucket, "symbolId"
WITH NO DATA;

-- 15-minute continuous aggregate
CREATE MATERIALIZED VIEW continuous_aggregate_15m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', time) AS bucket,
  "symbolId",
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY bucket, "symbolId"
WITH NO DATA;

-- 1-hour continuous aggregate
CREATE MATERIALIZED VIEW continuous_aggregate_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  "symbolId",
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY bucket, "symbolId"
WITH NO DATA;

-- 1-day continuous aggregate
CREATE MATERIALIZED VIEW continuous_aggregate_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  "symbolId",
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE timeframe = 'ONE_MINUTE'
GROUP BY bucket, "symbolId"
WITH NO DATA;

-- Create refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('continuous_aggregate_5m',
  start_offset => INTERVAL '1 month',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('continuous_aggregate_15m',
  start_offset => INTERVAL '3 months',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes');

SELECT add_continuous_aggregate_policy('continuous_aggregate_1h',
  start_offset => INTERVAL '6 months',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('continuous_aggregate_1d',
  start_offset => INTERVAL '5 years',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- Create tiered storage policies with data lifecycle management
-- Hot tier: Recent data, fully available, not compressed
-- Warm tier: Older data, compressed but still in main table
-- Cold tier: Historical data, heavily compressed and in separate chunks

-- Create a user-defined function to manually move chunks to cold storage
CREATE OR REPLACE FUNCTION move_chunk_to_cold_storage(
  chunk_name TEXT,
  destination_tablespace TEXT
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'ALTER TABLE %I SET TABLESPACE %I',
    chunk_name,
    destination_tablespace
  );
END;
$$ LANGUAGE plpgsql;

-- Create indexes on continuous aggregates for faster queries
CREATE INDEX IF NOT EXISTS "idx_5m_symbol_bucket" 
ON continuous_aggregate_5m ("symbolId", bucket DESC);

CREATE INDEX IF NOT EXISTS "idx_15m_symbol_bucket" 
ON continuous_aggregate_15m ("symbolId", bucket DESC);

CREATE INDEX IF NOT EXISTS "idx_1h_symbol_bucket" 
ON continuous_aggregate_1h ("symbolId", bucket DESC);

CREATE INDEX IF NOT EXISTS "idx_1d_symbol_bucket" 
ON continuous_aggregate_1d ("symbolId", bucket DESC);

-- Create a function to handle candle aggregation using continuous aggregates
CREATE OR REPLACE FUNCTION get_aggregate_candles(
  symbol_id TEXT,
  timeframe TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
) RETURNS TABLE (
  time TIMESTAMPTZ,
  open BIGINT,
  high BIGINT,
  low BIGINT,
  close BIGINT,
  volume BIGINT
) AS $$
BEGIN
  CASE timeframe
    WHEN '5m' THEN
      RETURN QUERY
      SELECT 
        bucket as time, 
        open::BIGINT, 
        high::BIGINT, 
        low::BIGINT, 
        close::BIGINT, 
        volume::BIGINT
      FROM continuous_aggregate_5m
      WHERE "symbolId" = symbol_id
        AND bucket BETWEEN start_time AND end_time
      ORDER BY bucket ASC;
    
    WHEN '15m' THEN
      RETURN QUERY
      SELECT 
        bucket as time, 
        open::BIGINT, 
        high::BIGINT, 
        low::BIGINT, 
        close::BIGINT, 
        volume::BIGINT
      FROM continuous_aggregate_15m
      WHERE "symbolId" = symbol_id
        AND bucket BETWEEN start_time AND end_time
      ORDER BY bucket ASC;
    
    WHEN '1h' THEN
      RETURN QUERY
      SELECT 
        bucket as time, 
        open::BIGINT, 
        high::BIGINT, 
        low::BIGINT, 
        close::BIGINT, 
        volume::BIGINT
      FROM continuous_aggregate_1h
      WHERE "symbolId" = symbol_id
        AND bucket BETWEEN start_time AND end_time
      ORDER BY bucket ASC;
    
    WHEN '1d' THEN
      RETURN QUERY
      SELECT 
        bucket as time, 
        open::BIGINT, 
        high::BIGINT, 
        low::BIGINT, 
        close::BIGINT, 
        volume::BIGINT
      FROM continuous_aggregate_1d
      WHERE "symbolId" = symbol_id
        AND bucket BETWEEN start_time AND end_time
      ORDER BY bucket ASC;
    
    ELSE
      RETURN QUERY
      SELECT o.time, o.open, o.high, o.low, o.close, o.volume
      FROM "OHLCV" o
      WHERE o."symbolId" = symbol_id
        AND o.timeframe = timeframe
        AND o.time BETWEEN start_time AND end_time
      ORDER BY o.time ASC;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create materialized views for frequently accessed time ranges
-- This improves query performance for common chart intervals
CREATE MATERIALIZED VIEW IF NOT EXISTS "OHLCV_1d_last_month" AS
SELECT * FROM "OHLCV"
WHERE timeframe = 'ONE_DAY' AND time > NOW() - INTERVAL '30 days'
ORDER BY time DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS "OHLCV_1h_last_week" AS
SELECT * FROM "OHLCV"
WHERE timeframe = 'ONE_HOUR' AND time > NOW() - INTERVAL '7 days'
ORDER BY time DESC;

-- Create index on materialized views
CREATE INDEX IF NOT EXISTS "idx_view_1d_month" ON "OHLCV_1d_last_month" ("symbolId", "time" DESC);
CREATE INDEX IF NOT EXISTS "idx_view_1h_week" ON "OHLCV_1h_last_week" ("symbolId", "time" DESC);

-- Create a function to regularly maintain the hypertable and refresh materialized views
CREATE OR REPLACE FUNCTION maintain_ohlcv_data()
RETURNS void AS $$
BEGIN
  -- Reorder recent chunks for better query performance
  PERFORM reorder_chunk(chunk, '"OHLCV_symbolId_timeframe_time_idx"')
  FROM (
    SELECT show.chunk_name AS chunk
    FROM timescaledb_information.chunks show
    INNER JOIN pg_class pgc ON pgc.relname = show.chunk_name
    INNER JOIN pg_namespace pgns ON pgc.relnamespace = pgns.oid AND pgns.nspname = show.chunk_schema
    WHERE hypertable_name = 'OHLCV'
    ORDER BY show.range_start DESC
    LIMIT 5
  ) recent_chunks;
  
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW "OHLCV_1d_last_month";
  REFRESH MATERIALIZED VIEW "OHLCV_1h_last_week";
END;
$$ LANGUAGE plpgsql;

-- Create a job to maintain the hypertable daily
SELECT add_job('maintain_ohlcv_data', INTERVAL '1 day');

-- Create functions for aggregate queries to optimize common chart data requests
CREATE OR REPLACE FUNCTION get_ohlcv_range(
  symbol_id TEXT,
  tf TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
) RETURNS TABLE (
  time TIMESTAMPTZ,
  open BIGINT,
  high BIGINT,
  low BIGINT,
  close BIGINT,
  volume BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.time, o.open, o.high, o.low, o.close, o.volume
  FROM "OHLCV" o
  WHERE o."symbolId" = symbol_id
    AND o.timeframe = tf
    AND o.time BETWEEN start_time AND end_time
  ORDER BY o.time ASC;
END;
$$ LANGUAGE plpgsql; 