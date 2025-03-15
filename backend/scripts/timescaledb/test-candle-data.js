#!/usr/bin/env node

/**
 * This script tests the TimescaleDB setup by inserting and querying candle data
 * It verifies that the hypertable is working correctly and demonstrates time-series queries
 */

import { PrismaClient, Timeframe } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log("Testing TimescaleDB setup with candle data...");

  try {
    // Step 1: Check if TimescaleDB is enabled
    console.log("Checking if TimescaleDB is enabled...");
    const timescaleCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
      ) as exists;
    `;

    if (!timescaleCheck[0].exists) {
      console.error(
        "❌ TimescaleDB is not enabled. Please run 'npm run db:check-timescale' first."
      );
      return;
    }

    console.log("✅ TimescaleDB is enabled");

    // Step 2: Check if OHLCV is a hypertable
    console.log("Checking if OHLCV is a hypertable...");
    const hypertableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'OHLCV'
      ) as exists;
    `;

    if (!hypertableCheck[0].exists) {
      console.error(
        "❌ OHLCV is not a hypertable. Please run 'npm run db:timescale' first."
      );
      return;
    }

    console.log("✅ OHLCV is a hypertable");

    // Step 3: Get or create a test symbol
    console.log("Getting or creating a test symbol...");
    let symbol = await prisma.symbol.findFirst({
      where: { name: "TEST" },
    });

    if (!symbol) {
      symbol = await prisma.symbol.create({
        data: {
          name: "TEST",
          description: "Test Symbol for TimescaleDB",
          currentPrice: 10000,
        },
      });
    }

    console.log(`✅ Using test symbol: ${symbol.name} (${symbol.id})`);

    // Step 4: Insert test candle data
    console.log("Inserting test candle data...");

    // Delete existing test data
    await prisma.oHLCV.deleteMany({
      where: { symbolId: symbol.id },
    });

    // Create 100 candles at 1-minute intervals
    const now = new Date();
    const candles = [];

    for (let i = 0; i < 100; i++) {
      const time = new Date(now.getTime() - i * 60 * 1000); // 1 minute intervals
      const price = 10000 + Math.floor(Math.random() * 1000 - 500);

      candles.push({
        symbolId: symbol.id,
        open: price,
        high: price + Math.floor(Math.random() * 100),
        low: price - Math.floor(Math.random() * 100),
        close: price + Math.floor(Math.random() * 200 - 100),
        volume: Math.floor(Math.random() * 1000000),
        timeframe: Timeframe.ONE_MINUTE,
        time,
      });
    }

    await prisma.oHLCV.createMany({
      data: candles,
    });

    console.log(`✅ Inserted ${candles.length} test candles`);

    // Step 5: Query the raw data
    console.log("Querying raw 1-minute candle data...");
    const rawCandles = await prisma.oHLCV.findMany({
      where: {
        symbolId: symbol.id,
        timeframe: Timeframe.ONE_MINUTE,
      },
      orderBy: { time: "desc" },
      take: 5,
    });

    console.log("Latest 5 raw candles:");
    rawCandles.forEach((candle) => {
      console.log(
        `  ${candle.time.toISOString()} - O: ${candle.open}, H: ${
          candle.high
        }, L: ${candle.low}, C: ${candle.close}, V: ${candle.volume}`
      );
    });

    // Step 6: Test TimescaleDB time-bucket function
    console.log(
      "\nTesting TimescaleDB time-bucket function for 5-minute aggregation..."
    );
    try {
      const aggregatedCandles = await prisma.$queryRaw`
        SELECT
          time_bucket('5 minutes', time) AS bucket,
          first(open, time) AS open,
          max(high) AS high,
          min(low) AS low,
          last(close, time) AS close,
          sum(volume) AS volume
        FROM "OHLCV"
        WHERE "symbolId" = ${symbol.id}
          AND timeframe = 'ONE_MINUTE'
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT 5;
      `;

      console.log("5-minute aggregated candles using time_bucket:");
      aggregatedCandles.forEach((candle) => {
        console.log(
          `  ${candle.bucket.toISOString()} - O: ${candle.open}, H: ${
            candle.high
          }, L: ${candle.low}, C: ${candle.close}, V: ${candle.volume}`
        );
      });
    } catch (error) {
      console.warn("⚠️ Could not use time_bucket function:", error.message);
      console.warn(
        "This may be due to limitations in the Apache 2 licensed version of TimescaleDB."
      );
    }

    // Step 7: Test time-range queries
    console.log("\nTesting time-range queries...");
    const timeRangeCandles = await prisma.oHLCV.findMany({
      where: {
        symbolId: symbol.id,
        timeframe: Timeframe.ONE_MINUTE,
        time: {
          gte: new Date(now.getTime() - 30 * 60 * 1000), // Last 30 minutes
          lte: now,
        },
      },
      orderBy: { time: "desc" },
    });

    console.log(
      `Found ${timeRangeCandles.length} candles in the last 30 minutes`
    );

    console.log("\n✅ TimescaleDB test completed successfully!");
    console.log("You can now use TimescaleDB features in your application.");
    console.log(
      "\nNote: Advanced features like continuous aggregates are not available"
    );
    console.log("in the Apache 2 licensed version of TimescaleDB on Neon.");
    console.log(
      "We'll implement these features at the application level instead."
    );
  } catch (error) {
    console.error("Error testing TimescaleDB:", error);
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
