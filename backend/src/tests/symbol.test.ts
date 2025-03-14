/**
 * Symbol Routes Tests
 *
 * Tests for symbol retrieval and price updates.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { app } from "../index";
import { prisma } from "../server";
import supertest from "supertest";

const request = supertest(app);

describe("Symbol API", () => {
  let symbolId: string;

  // Set up test data before all tests
  beforeAll(async () => {
    // Create test symbols
    const symbols = [
      {
        name: "btcusdt",
        description: "Bitcoin/USDT",
        currentPrice: 5000000, // $50,000.00 in cents
      },
      {
        name: "ethusdt",
        description: "Ethereum/USDT",
        currentPrice: 300000, // $3,000.00 in cents
      },
    ];

    for (const symbolData of symbols) {
      const symbol = await prisma.symbol.upsert({
        where: { name: symbolData.name },
        update: {
          currentPrice: symbolData.currentPrice,
        },
        create: symbolData,
      });

      if (symbolData.name === "btcusdt") {
        symbolId = symbol.id;
      }
    }
  });

  describe("GET /api/symbols", () => {
    it("should get all symbols", async () => {
      const response = await request.get("/api/symbols");

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(2);

      const btcSymbol = response.body.find((s: any) => s.name === "btcusdt");
      expect(btcSymbol).toBeDefined();
      expect(btcSymbol).toHaveProperty("id");
      expect(btcSymbol).toHaveProperty("name", "btcusdt");
      expect(btcSymbol).toHaveProperty("description", "Bitcoin/USDT");
      expect(btcSymbol).toHaveProperty("currentPrice", 50000); // Converted to dollars
    });
  });

  describe("GET /api/symbols/:name", () => {
    it("should get a symbol by name", async () => {
      const response = await request.get("/api/symbols/btcusdt");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id", symbolId);
      expect(response.body).toHaveProperty("name", "btcusdt");
      expect(response.body).toHaveProperty("description", "Bitcoin/USDT");
      expect(response.body).toHaveProperty("currentPrice", 50000); // Converted to dollars
    });

    it("should return 404 if symbol does not exist", async () => {
      const response = await request.get("/api/symbols/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Symbol not found");
    });
  });

  describe("GET /api/symbols/prices", () => {
    it("should get latest prices for all symbols", async () => {
      const response = await request.get("/api/symbols/prices");

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Object);

      // Note: This test might be flaky if the binanceService is mocked
      // or if the WebSocket connection is not established
      // In a real test environment, we would mock the binanceService
    });
  });
});
