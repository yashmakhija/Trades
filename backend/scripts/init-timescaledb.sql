-- Create TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- After Prisma has created the tables, convert OHLCV to a hypertable
SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE);

-- Create appropriate indexes for TimescaleDB to work efficiently
CREATE INDEX IF NOT EXISTS "idx_ohlcv_symbol_time" ON "OHLCV" ("symbolId", "time" DESC);

-- Set chunk time interval to 1 day (for development, adjust for production)
SELECT set_chunk_time_interval('"OHLCV"', INTERVAL '1 day');

-- Optional: Add compression policy (uncomment for production)
-- SELECT add_compression_policy('"OHLCV"', INTERVAL '7 days');

-- Create a function to regularly maintain the hypertable
CREATE OR REPLACE FUNCTION maintain_hypertable()
RETURNS void AS $$
BEGIN
  PERFORM reorder_chunk(chunk, '"OHLCV_symbolId_timeframe_time_idx"')
  FROM (
    SELECT show.chunk_name AS chunk
    FROM timescaledb_information.chunks show
    INNER JOIN pg_class pgc ON pgc.relname = show.chunk_name
    INNER JOIN pg_namespace pgns ON pgc.relnamespace = pgns.oid AND pgns.nspname = show.chunk_schema
    ORDER BY show.range_start DESC
    LIMIT 2
  ) recent_chunks;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to maintain the hypertable (uncomment for production)
-- SELECT add_job('maintain_hypertable', '24h'); 