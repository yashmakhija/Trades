#!/usr/bin/env node

/**
 * This script sets up PostgreSQL for the OHLCV table
 * It creates standard indexes for time-series data without requiring TimescaleDB
 */

import { PrismaClient } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log("Setting up PostgreSQL for OHLCV table...");

  try {
    // Create indexes for better query performance
    console.log("Creating indexes for OHLCV table...");
    
    // Index for time-based queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_time_desc ON "OHLCV" (time DESC);
    `;
    
    // Compound index for symbol and time queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_symbolid_time ON "OHLCV" ("symbolId", time DESC);
    `;
    
    // Compound index for symbol, timeframe and time queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_symbolid_timeframe_time ON "OHLCV" ("symbolId", timeframe, time DESC);
    `;
    
    // Index for timeframe filtering
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_timeframe ON "OHLCV" (timeframe);
    `;

    console.log("PostgreSQL setup completed successfully!");
  } catch (error) {
    console.error("Error setting up PostgreSQL:", error);
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