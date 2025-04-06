import { describe, it, expect, beforeEach, mock } from "bun:test";
import { app } from "../../server";
import { EventEmitter } from "events";
import supertest from "supertest";
import express from "express";
import { FixService } from "../../services/fix/fixService";
import { fixConfig } from "../../config/fix.config";
import fixRoutes from "../../routes/fixRoutes";
import { FixClient } from "nodefix";
import { Request, Response } from "express";
import { FixController } from "../../controllers/fix/fixController";

const request = supertest(app);

// Define types for our mock data
interface Order {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  type: "MARKET" | "LIMIT";
}

interface OrderResponse {
  orderId: string;
  clientOrderId: string;
}

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
}

// Create a mock FixClient class
class MockFixClient {
  createConnection = mock(() => Promise.resolve());
  sendMsg = mock(() => Promise.resolve());
  sendLogon = mock(() => Promise.resolve());
  sendLogoff = mock(() => Promise.resolve());
  destroyConnection = mock(() => Promise.resolve());
  modifyBehavior = mock(() => Promise.resolve());
  on = mock(() => Promise.resolve());
  emit = mock(() => Promise.resolve());
}

// Mock the FixClient module
mock.module("nodefix", () => ({
  FixClient: mock(() => new MockFixClient()),
}));

// Mock FixService
const mockFixService = {
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  subscribeMarketData: mock(() => Promise.resolve()),
  unsubscribeMarketData: mock(() => Promise.resolve()),
  placeOrder: mock(() =>
    Promise.resolve({
      orderId: "12345",
      clientOrderId: "CLIENT-123",
    })
  ),
  cancelOrder: mock(() => Promise.resolve()),
  getPositions: mock(() =>
    Promise.resolve([{ symbol: "EURUSD", quantity: 100000, averagePrice: 1.1 }])
  ),
  getPosition: mock(() =>
    Promise.resolve({
      symbol: "EURUSD",
      quantity: 100000,
      averagePrice: 1.1,
    } as Position)
  ),
  on: mock(),
  emit: mock(),
};

// Mock the FixService module
mock.module("../../services/fix/fixService", () => ({
  FixService: mock(() => mockFixService),
}));

describe("FIX Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore();

    mockRequest = {
      params: {},
      body: {},
    };

    mockResponse = {
      json: mock(() => mockResponse),
      status: mock(() => mockResponse),
    } as unknown as Partial<Response>;
  });

  describe("Session Management", () => {
    it("should get FIX session status", async () => {
      const response = await request.get("/api/fix/status").expect(200);

      expect(response.body).toEqual({
        isConnected: true,
      });
    });
  });

  describe("Market Data", () => {
    it("should subscribe to market data", async () => {
      const symbol = "EURUSD";

      await request
        .post(`/api/fix/market-data/${symbol}/subscribe`)
        .expect(200);

      expect(mockFixService.subscribeMarketData).toHaveBeenCalledWith(symbol);
    });

    it("should unsubscribe from market data", async () => {
      const symbol = "EURUSD";

      await request
        .post(`/api/fix/market-data/${symbol}/unsubscribe`)
        .expect(200);

      expect(mockFixService.unsubscribeMarketData).toHaveBeenCalledWith(symbol);
    });
  });

  describe("Order Management", () => {
    it("should place a new order", async () => {
      const order: Order = {
        symbol: "EURUSD",
        side: "BUY",
        quantity: 100000,
        price: 1.1,
        type: "LIMIT",
      };

      const response = await request
        .post("/api/fix/orders")
        .send(order)
        .expect(200);

      expect(response.body).toEqual({
        orderId: "12345",
        clientOrderId: "CLIENT-123",
      });
    });

    it("should reject invalid orders", async () => {
      const invalidOrder = {
        symbol: "EURUSD",
        // Missing required fields
      };

      await request.post("/api/fix/orders").send(invalidOrder).expect(400);
    });

    it("should cancel an order", async () => {
      const orderId = "12345";
      const clientOrderId = "CLIENT-123";

      await request
        .delete(`/api/fix/orders/${orderId}/${clientOrderId}`)
        .expect(200);

      expect(mockFixService.cancelOrder).toHaveBeenCalledWith(
        orderId,
        clientOrderId
      );
    });
  });

  describe("Position Management", () => {
    it("should get all positions", async () => {
      const response = await request.get("/api/fix/positions").expect(200);

      expect(response.body).toEqual([
        { symbol: "EURUSD", quantity: 100000, averagePrice: 1.1 },
      ]);
    });

    it("should get position for a symbol", async () => {
      const symbol = "EURUSD";

      const response = await request
        .get(`/api/fix/positions/${symbol}`)
        .expect(200);

      expect(response.body).toEqual({
        symbol: "EURUSD",
        quantity: 100000,
        averagePrice: 1.1,
      });
    });

    it("should handle non-existent positions", async () => {
      const symbol = "GBPUSD";
      mockFixService.getPosition = mock(() =>
        Promise.resolve(null as unknown as Position)
      );

      await request.get(`/api/fix/positions/${symbol}`).expect(404);
    });
  });

  describe("Error Handling", () => {
    it("should handle order placement errors", async () => {
      mockFixService.placeOrder = mock(() =>
        Promise.reject(new Error("Order placement failed"))
      );

      const order: Order = {
        symbol: "EURUSD",
        side: "BUY",
        quantity: 100000,
        price: 1.1,
        type: "LIMIT",
      };

      const response = await request
        .post("/api/fix/orders")
        .send(order)
        .expect(500);

      expect(response.body).toEqual({
        error: "Failed to place order",
      });
    });
  });
});
