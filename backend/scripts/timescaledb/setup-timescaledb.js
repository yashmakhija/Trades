#!/usr/bin/env node

/**
 * This script sets up TimescaleDB for the OHLCV table
 * It enables the extension and converts the OHLCV table to a hypertable
 */

import { PrismaClient } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log("Setting up TimescaleDB for OHLCV table...");

  try {
    // Step 1: Enable the TimescaleDB extension
    console.log("Enabling TimescaleDB extension...");
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS timescaledb;`;
    console.log("TimescaleDB extension enabled successfully");

    // Step 2: Check if the OHLCV table exists and has data
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'OHLCV'
      ) as exists;
    `;

    if (!tableCheck[0].exists) {
      console.log(
        "OHLCV table does not exist. Please run prisma migrate first."
      );
      return;
    }

    // Step 3: Convert the OHLCV table to a hypertable
    console.log("Converting OHLCV table to a hypertable...");
    await prisma.$executeRaw`SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE, migrate_data => TRUE);`;
    console.log("OHLCV table converted to hypertable successfully");

    // Step 4: Create indexes for better query performance
    console.log("Creating indexes for OHLCV table...");
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_ohlcv_symbolid_time_timeframe ON "OHLCV" ("symbolId", time, timeframe);`;
    console.log("Indexes created successfully");

    // Step 5: Check TimescaleDB version
    console.log("Checking TimescaleDB version...");
    try {
      const versionInfo =
        await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';`;
      console.log(`TimescaleDB version: ${versionInfo[0].extversion}`);
    } catch (error) {
      console.log("Could not retrieve TimescaleDB version information");
    }

    console.log(
      "\nNote: Advanced features like continuous aggregates and retention policies"
    );
    console.log(
      "are not available in the Apache 2 licensed version of TimescaleDB on Neon."
    );
    console.log(
      "We'll implement these features at the application level instead."
    );

    console.log("\nTimescaleDB basic setup completed successfully!");
    console.log(
      "The OHLCV table is now a hypertable, which will improve query performance for time-series data."
    );
    console.log(
      "You can now use TimescaleDB's time-series functions in your queries."
    );
  } catch (error) {
    console.error("Error setting up TimescaleDB:", error);

    // Provide more helpful error messages based on error type
    if (error.message?.includes('extension "timescaledb" is not available')) {
      console.error(
        "\n⚠️ TimescaleDB extension is not available on your database."
      );
      console.error(
        "Please check if your PostgreSQL provider supports TimescaleDB."
      );
      console.error(
        "For Neon PostgreSQL, you may need to enable the extension in your project settings."
      );
      console.error(
        "Visit: https://neon.tech/docs/extensions/timescaledb for more information.\n"
      );
    } else if (error.message?.includes("permission denied")) {
      console.error("\n⚠️ Permission denied when setting up TimescaleDB.");
      console.error(
        "You may need elevated privileges to perform this operation."
      );
      console.error(
        "Please contact your database administrator or check your connection string.\n"
      );
    } else if (error.message?.includes('relation "OHLCV" does not exist')) {
      console.error("\n⚠️ The OHLCV table does not exist.");
      console.error(
        "Please run 'npx prisma migrate dev' or 'npx prisma db push' first to create the table.\n"
      );
    } else if (
      error.meta?.message?.includes(
        'functionality not supported under the current "apache" license'
      )
    ) {
      console.error(
        "\n⚠️ This feature is not available in the Apache 2 licensed version of TimescaleDB."
      );
      console.error(
        "Neon PostgreSQL provides TimescaleDB with the Apache 2 license, which has some limitations."
      );
      console.error(
        "We'll implement these features at the application level instead.\n"
      );
    }

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
