/**
 * Database Initialization Script
 *
 * This script initializes the database with default trading symbols.
 * It's meant to be run once during initial setup or when adding new symbols.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_SYMBOLS = "btcusdt,ethusdt,bnbusdt,solusdt,adausdt";

async function initializeSymbols(): Promise<void> {
  try {
    const symbolsEnv = process.env.TRADING_SYMBOLS || DEFAULT_SYMBOLS;
    const symbols = symbolsEnv.split(",");

    console.log(`Initializing symbols: ${symbols.join(", ")}`);

    for (const symbolName of symbols) {
      const symbol = await prisma.symbol.upsert({
        where: { name: symbolName.toLowerCase() },
        update: {},
        create: {
          name: symbolName.toLowerCase(),
          description: `${symbolName.toUpperCase()} trading pair`,
        },
      });

      console.log(
        `Initialized symbol: ${symbolName.toLowerCase()} with ID: ${symbol.id}`
      );
    }

    console.log("All symbols initialized successfully");
  } catch (error) {
    console.error("Error initializing symbols:", error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeSymbols()
  .then(() => {
    console.log("Database initialization completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
