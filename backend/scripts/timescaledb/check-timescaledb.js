#!/usr/bin/env node

/**
 * This script checks if TimescaleDB is available on the database
 * It attempts to enable the extension and reports the result
 */

import { PrismaClient } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log("Checking TimescaleDB availability...");

  try {
    // Check if we can connect to the database
    console.log("Testing database connection...");
    await prisma.$queryRaw`SELECT 1;`;
    console.log("✅ Database connection successful");

    // Try to enable the TimescaleDB extension
    console.log("Attempting to enable TimescaleDB extension...");
    try {
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS timescaledb;`;

      // Verify that TimescaleDB is enabled
      const result = await prisma.$queryRaw`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'timescaledb';
      `;

      if (result.length > 0) {
        console.log("✅ TimescaleDB is available and enabled!");
        console.log(`   Version: ${result[0].extversion}`);
        console.log(
          "\nYou can now run the setup script to configure TimescaleDB for your OHLCV table:"
        );
        console.log("   npm run db:timescale");
      } else {
        console.log("❌ TimescaleDB extension could not be enabled");
        console.log(
          "   The extension might not be available on your PostgreSQL provider"
        );
      }
    } catch (error) {
      console.error(
        "❌ Failed to enable TimescaleDB extension:",
        error.message
      );

      if (error.message.includes('extension "timescaledb" is not available')) {
        console.log("\nTimescaleDB is not available on your database.");
        console.log(
          "If you're using Neon PostgreSQL, you need to enable it in your project settings."
        );
        console.log(
          "Visit: https://neon.tech/docs/extensions/timescaledb for more information."
        );
      } else if (error.message.includes("permission denied")) {
        console.log("\nYou don't have permission to create extensions.");
        console.log("Please contact your database administrator.");
      }
    }
  } catch (error) {
    console.error("Error connecting to the database:", error);
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
