#!/usr/bin/env node

/**
 * This script sets up TimescaleDB continuous aggregates for the OHLCV table
 * It should be run after the basic TimescaleDB setup is confirmed working
 */

import { PrismaClient } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log(
    "Setting up TimescaleDB continuous aggregates for OHLCV table..."
  );

  try {
    // First, ensure the TimescaleDB extension is enabled
    console.log("Ensuring TimescaleDB extension is enabled...");
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS timescaledb;`;
    console.log("TimescaleDB extension enabled");

    // Check if OHLCV is a hypertable
    console.log("Checking if OHLCV is a hypertable...");
    const hypertableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'OHLCV'
      ) as exists;
    `;

    console.log("Hypertable check:", hypertableCheck);

    if (!hypertableCheck[0].exists) {
      console.log("OHLCV is not a hypertable. Converting it now...");
      await prisma.$executeRaw`SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE, migrate_data => TRUE);`;
      console.log("OHLCV table converted to hypertable");
    } else {
      console.log("OHLCV is already a hypertable");
    }

    console.log("Creating continuous aggregate for 5-minute candles...");
    await prisma.$executeRaw`
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
    `;

    console.log("Creating continuous aggregate for 15-minute candles...");
    await prisma.$executeRaw`
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
    `;

    console.log("Creating continuous aggregate for 1-hour candles...");
    await prisma.$executeRaw`
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
    `;

    console.log("Creating continuous aggregate for 1-day candles...");
    await prisma.$executeRaw`
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
    `;

    console.log("Setting up retention policy...");
    await prisma.$executeRaw`
      SELECT add_retention_policy('"OHLCV"', INTERVAL '7 days', if_not_exists => TRUE);
    `;

    console.log("Setting up refresh policies for continuous aggregates...");

    // Add refresh policies for each continuous aggregate
    await prisma.$executeRaw`
      SELECT add_continuous_aggregate_policy('candles_5m',
        start_offset => INTERVAL '1 day',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '5 minutes',
        if_not_exists => TRUE
      );
    `;

    await prisma.$executeRaw`
      SELECT add_continuous_aggregate_policy('candles_15m',
        start_offset => INTERVAL '1 day',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '15 minutes',
        if_not_exists => TRUE
      );
    `;

    await prisma.$executeRaw`
      SELECT add_continuous_aggregate_policy('candles_1h',
        start_offset => INTERVAL '1 day',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE
      );
    `;

    await prisma.$executeRaw`
      SELECT add_continuous_aggregate_policy('candles_1d',
        start_offset => INTERVAL '7 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );
    `;

    console.log("Adding comments for documentation...");
    await prisma.$executeRaw`COMMENT ON MATERIALIZED VIEW candles_5m IS 'Pre-computed 5-minute candles from 1-minute data';`;
    await prisma.$executeRaw`COMMENT ON MATERIALIZED VIEW candles_15m IS 'Pre-computed 15-minute candles from 1-minute data';`;
    await prisma.$executeRaw`COMMENT ON MATERIALIZED VIEW candles_1h IS 'Pre-computed 1-hour candles from 1-minute data';`;
    await prisma.$executeRaw`COMMENT ON MATERIALIZED VIEW candles_1d IS 'Pre-computed 1-day candles from 1-minute data';`;

    console.log(
      "TimescaleDB continuous aggregates setup completed successfully!"
    );
  } catch (error) {
    console.error("Error setting up TimescaleDB continuous aggregates:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
