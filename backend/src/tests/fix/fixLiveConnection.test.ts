import { FixClient } from "../../fix/FixClient";
import { describe, test, expect } from "bun:test";
import * as tls from "tls";

describe("FIX Live Connection Tests", () => {
  const MARKET_DATA_CONFIG = {
    host: "cntuk.centroidsol.com",
    port: 43510,
    username: process.env.FIX_USERNAME,
    password: process.env.FIX_PASSWORD,
    senderCompID: "MD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    ssl: false,
    resetOnLogon: true,
  };

  const TRADING_CONFIG = {
    host: "cntuk.centroidsol.com",
    port: 43511,
    username: process.env.FIX_USERNAME,
    password: process.env.FIX_PASSWORD,
    senderCompID: "TD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    ssl: true,
    resetOnLogon: false,
    sslOptions: {
      rejectUnauthorized: false, // For testing only - remove in production
    },
  };

  test("should connect to live market data server", async () => {
    const client = new FixClient(MARKET_DATA_CONFIG);

    const connected = await new Promise((resolve) => {
      client.on("connected", () => {
        console.log("Market Data: Successfully connected");
        resolve(true);
      });

      client.on("error", (error) => {
        console.error("Market Data Connection Error:", {
          message: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          host: MARKET_DATA_CONFIG.host,
          port: MARKET_DATA_CONFIG.port,
        });
        resolve(false);
      });

      client.on("disconnected", () => {
        console.log("Market Data: Disconnected");
      });

      console.log("Attempting to connect to market data server...");
      client.connect();
    });

    expect(connected).toBe(true);
    client.disconnect();
  });

  test("should connect to live trading server", async () => {
    const client = new FixClient(TRADING_CONFIG);

    const connected = await new Promise((resolve) => {
      client.on("connected", () => {
        console.log("Trading: Successfully connected");
        resolve(true);
      });

      client.on("error", (error) => {
        console.error("Trading Connection Error:", {
          message: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          host: TRADING_CONFIG.host,
          port: TRADING_CONFIG.port,
        });
        resolve(false);
      });

      client.on("disconnected", () => {
        console.log("Trading: Disconnected");
      });

      console.log("Attempting to connect to trading server...");
      client.connect();
    });

    expect(connected).toBe(true);
    client.disconnect();
  });
});
