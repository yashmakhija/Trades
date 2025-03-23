#!/usr/bin/env bun

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000; // ms

const prisma = new PrismaClient();

async function waitForDatabase() {
  console.log("Checking database connection...");

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // Try a simple query to check if the database is available
      await prisma.$queryRaw`SELECT 1`;
      console.log("Database is available!");
      await prisma.$disconnect();
      return;
    } catch (error) {
      console.log(
        `Database not available yet (attempt ${
          i + 1
        }/${MAX_RETRIES}), waiting...`
      );
      // Wait before the next attempt
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }
  }

  console.error("Failed to connect to database after maximum retries");
  process.exit(1);
}

await waitForDatabase();
