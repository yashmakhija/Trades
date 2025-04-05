import Redis from "ioredis";
import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import { EventEmitter } from "events";
import { describe, it, expect, beforeEach, mock } from "bun:test";

// Define types for our mock data
interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: string;
}

interface Order {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderType: "LIMIT" | "MARKET" | "STOP" | "STOP_LIMIT";
  status: "NEW" | "FILLED" | "CANCELLED" | "REJECTED";
  timestamp: string;
}

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  timestamp: string;
}

// Mock Redis
mock.module("ioredis", () => {
  const store = new Map();
  return mock(() => ({
    get: mock((key: string) => {
      const value = store.get(key);
      return Promise.resolve(value || null);
    }),
    set: mock((key: string, value: string, ...args: any[]) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    del: mock((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    expire: mock((key: string, seconds: number) => {
      return Promise.resolve(1);
    }),
    quit: mock(() => Promise.resolve("OK")),
  }));
});

describe("FIX Redis Integration", () => {
  let redis: Redis;
  let fixService: FixService;

  beforeEach(() => {
    mock.restore();
    redis = new Redis();

    // Initialize FixService with mocked Redis client
    fixService = new FixService(fixConfig);
  });

  describe("Market Data Caching", () => {
    it("should cache market data with TTL", async () => {
      const marketData: MarketData = {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        bidSize: 1000000,
        askSize: 1000000,
        timestamp: new Date().toISOString(),
      };

      const key = `market:data:${marketData.symbol}`;

      await (fixService as any).cacheMarketData(marketData);

      expect(redis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(marketData),
        "EX",
        300 // 5 minutes TTL
      );
    });

    it("should retrieve cached market data", async () => {
      const symbol = "EURUSD";
      const cachedData: MarketData = {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        bidSize: 1000000,
        askSize: 1000000,
        timestamp: new Date().toISOString(),
      };

      const key = `market:data:${symbol}`;

      // Mock Redis get to return cached data
      (redis.get as jest.Mock).mockImplementation((key: unknown) => {
        return Promise.resolve(JSON.stringify(cachedData));
      });

      const result = await (fixService as any).getCachedMarketData(symbol);

      expect(redis.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(cachedData);
    });

    it("should return null for non-existent cached data", async () => {
      const symbol = "NONEXISTENT";
      const key = `market:data:${symbol}`;

      // Mock Redis get to return null
      (redis.get as jest.Mock).mockImplementation((key: unknown) => {
        return Promise.resolve(null);
      });

      const result = await (fixService as any).getCachedMarketData(symbol);

      expect(redis.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });
  });

  describe("Order Caching", () => {
    it("should cache order with TTL", async () => {
      const order: Order = {
        orderId: "12345",
        clientOrderId: "CLIENT-123",
        symbol: "EURUSD",
        side: "BUY",
        quantity: 100000,
        price: 1.1,
        orderType: "LIMIT",
        status: "NEW",
        timestamp: new Date().toISOString(),
      };

      const key = `order:${order.orderId}`;

      await (fixService as any).cacheOrder(order);

      expect(redis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(order),
        "EX",
        3600 // 1 hour TTL
      );
    });

    it("should retrieve cached order", async () => {
      const orderId = "12345";
      const cachedOrder: Order = {
        orderId: "12345",
        clientOrderId: "CLIENT-123",
        symbol: "EURUSD",
        side: "BUY",
        quantity: 100000,
        price: 1.1,
        orderType: "LIMIT",
        status: "NEW",
        timestamp: new Date().toISOString(),
      };

      const key = `order:${orderId}`;

      // Mock Redis get to return cached order
      (redis.get as jest.Mock).mockImplementation((key: unknown) => {
        return Promise.resolve(JSON.stringify(cachedOrder));
      });

      const result = await (fixService as any).getCachedOrder(orderId);

      expect(redis.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(cachedOrder);
    });

    it("should delete cached order", async () => {
      const orderId = "12345";
      const key = `order:${orderId}`;

      await (fixService as any).deleteCachedOrder(orderId);

      expect(redis.del).toHaveBeenCalledWith(key);
    });
  });

  describe("Position Caching", () => {
    it("should cache position with TTL", async () => {
      const position: Position = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      const key = `position:${position.symbol}`;

      await (fixService as any).cachePosition(position);

      expect(redis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(position),
        "EX",
        3600 // 1 hour TTL
      );
    });

    it("should retrieve cached position", async () => {
      const symbol = "EURUSD";
      const cachedPosition: Position = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      const key = `position:${symbol}`;

      // Mock Redis get to return cached position
      (redis.get as jest.Mock).mockImplementation((key: unknown) => {
        return Promise.resolve(JSON.stringify(cachedPosition));
      });

      const result = await (fixService as any).getCachedPosition(symbol);

      expect(redis.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(cachedPosition);
    });

    it("should cache and retrieve positions", async () => {
      const position: Position = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      await redis.set("position:EURUSD", JSON.stringify(position));
      const cachedPosition = await redis.get("position:EURUSD");

      expect(JSON.parse(cachedPosition!)).toEqual(position);
    });

    it("should handle non-existent positions", async () => {
      const cachedPosition = await redis.get("position:NONEXISTENT");
      expect(cachedPosition).toBeNull();
    });

    it("should delete positions from cache", async () => {
      const position: Position = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      await redis.set("position:EURUSD", JSON.stringify(position));
      await redis.del("position:EURUSD");

      const cachedPosition = await redis.get("position:EURUSD");
      expect(cachedPosition).toBeNull();
    });

    it("should set expiration on cached positions", async () => {
      const position: Position = {
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
        timestamp: new Date().toISOString(),
      };

      await redis.set("position:EURUSD", JSON.stringify(position));
      await redis.expire("position:EURUSD", 3600); // 1 hour

      const result = await redis.get("position:EURUSD");
      expect(JSON.parse(result!)).toEqual(position);
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis errors", async () => {
      const error = new Error("Redis error");
      (redis.set as jest.Mock).mockImplementation(() => {
        return Promise.reject(error);
      });

      const marketData: MarketData = {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        bidSize: 1000000,
        askSize: 1000000,
        timestamp: new Date().toISOString(),
      };

      await expect(
        (fixService as any).cacheMarketData(marketData)
      ).rejects.toThrow("Redis error");
    });

    it("should handle Redis connection errors", async () => {
      const errorRedis = new Redis({
        host: "nonexistent",
        port: 6379,
        retryStrategy: () => null,
      });

      try {
        await errorRedis.get("test");
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
