#!/usr/bin/env node

/**
 * TimescaleDB Setup Script
 *
 * This script provides a unified interface for setting up TimescaleDB for the trading application.
 * It can check availability, set up the hypertable, and test the implementation.
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a new Prisma client instance
const prisma = new PrismaClient();

// Command line arguments
const args = process.argv.slice(2);
const command = args[0] || "help";

async function main() {
  try {
    switch (command) {
      case "check":
        console.log("Checking TimescaleDB availability...");
        execSync(`node ${join(__dirname, "check-timescaledb.js")}`, {
          stdio: "inherit",
        });
        break;

      case "setup":
        console.log("Setting up TimescaleDB...");
        execSync(`node ${join(__dirname, "setup-timescaledb.js")}`, {
          stdio: "inherit",
        });
        break;

      case "test":
        console.log("Testing TimescaleDB implementation...");
        execSync(`node ${join(__dirname, "test-candle-data.js")}`, {
          stdio: "inherit",
        });
        break;

      case "help":
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function showHelp() {
  console.log(`
TimescaleDB Setup Script

Usage:
  node scripts/timescaledb/index.js [command]

Commands:
  check   Check if TimescaleDB is available on your database
  setup   Set up TimescaleDB for the OHLCV table
  test    Test the TimescaleDB implementation
  help    Show this help message

Examples:
  node scripts/timescaledb/index.js check
  node scripts/timescaledb/index.js setup
  node scripts/timescaledb/index.js test
  `);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
