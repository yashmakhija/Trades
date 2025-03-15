#!/usr/bin/env node

/**
 * This script applies the TimescaleDB schema fix to the OHLCV table
 * It modifies the primary key to include the 'time' column
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new Prisma client instance
const prisma = new PrismaClient();

async function main() {
  console.log("Applying TimescaleDB schema fix to OHLCV table...");

  try {
    // Read the SQL migration file
    const sqlFilePath = path.join(
      __dirname,
      "../prisma/migrations/timescale_schema_fix.sql"
    );
    console.log("Reading SQL file:", sqlFilePath);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");
    console.log("SQL content:", sqlContent);

    // Execute the SQL statements directly
    console.log("Dropping primary key constraint...");
    await prisma.$executeRaw`ALTER TABLE "OHLCV" DROP CONSTRAINT "OHLCV_pkey";`;
    console.log("Primary key constraint dropped successfully");

    console.log("Adding new composite primary key...");
    await prisma.$executeRaw`ALTER TABLE "OHLCV" ADD PRIMARY KEY ("id", "time");`;
    console.log("Composite primary key added successfully");

    console.log("TimescaleDB schema fix applied successfully!");
    console.log(
      "You can now run the setup-timescaledb.js script to convert the table to a hypertable."
    );
  } catch (error) {
    console.error("Error applying TimescaleDB schema fix:", error);
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
