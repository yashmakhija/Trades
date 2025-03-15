#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing database connection...");

    // Test basic query
    const result = await prisma.$queryRaw`SELECT version();`;
    console.log("Database connection successful:", result);

    // Check available extensions
    const availableExtensions =
      await prisma.$queryRaw`SELECT * FROM pg_available_extensions;`;
    console.log("Available extensions:", availableExtensions);

    // Check installed extensions
    const installedExtensions =
      await prisma.$queryRaw`SELECT extname, extversion FROM pg_extension;`;
    console.log("Installed extensions:", installedExtensions);

    // Try to enable TimescaleDB extension
    try {
      console.log("Attempting to enable TimescaleDB extension...");
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`;
      console.log("TimescaleDB extension enabled successfully");

      // Check if TimescaleDB is now installed
      const timescaleVersion =
        await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';`;
      console.log("TimescaleDB version:", timescaleVersion);
    } catch (error) {
      console.error("Failed to enable TimescaleDB extension:", error);
    }

    // Check if OHLCV table exists
    const tableExists = await prisma.$queryRaw`SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'OHLCV'
    );`;
    console.log("OHLCV table exists:", tableExists);

    // Check OHLCV table structure
    if (tableExists[0].exists) {
      const tableStructure = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'OHLCV';
      `;
      console.log("OHLCV table structure:", tableStructure);
    }
  } catch (error) {
    console.error("Database error:", error);
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
