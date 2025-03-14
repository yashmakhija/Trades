/**
 * Order Routes Tests
 *
 * Tests for order placement, cancellation, and retrieval.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { app } from "../index";
import { prisma } from "../server";
import { OrderStatus, OrderType } from "@prisma/client";
import supertest from "supertest";

const request = supertest(app);

describe("Order API", () => {
  let authToken: string;
  let userId: string;
  let symbolId: string;
  let orderId: string;

  // Set up test data before all tests
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "order-test@example.com",
        password: await Bun.password.hash("Password123!"),
        name: "Order Test User",
        usdcBalance: 1000000, // $10,000.00 in cents
      },
    });
    userId = user.id;

    // Create test symbol
    const symbol = await prisma.symbol.upsert({
      where: { name: "btcusdt" },
      update: {},
      create: {
        name: "btcusdt",
        description: "Bitcoin/USDT",
        currentPrice: 5000000, // $50,000.00 in cents
      },
    });
    symbolId = symbol.id;

    // Login to get auth token
    const loginResponse = await request.post("/api/auth/login").send({
      email: "order-test@example.com",
      password: "Password123!",
    });

    authToken = loginResponse.body.token;
  });

  // Clean up test data after all tests
  afterAll(async () => {
    // Delete test orders
    await prisma.order.deleteMany({
      where: {
        userId,
      },
    });

    // Delete test user
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });
  });

  describe("POST /api/orders", () => {
    it("should place a new buy order", async () => {
      const response = await request
        .post("/api/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          symbolId,
          type: OrderType.BUY,
          price: 5000000, // $50,000.00 in cents
          quantity: 0.1, // 0.1 BTC
          isShort: false,
          stopLoss: 4800000, // $48,000.00 in cents
          takeProfit: 5500000, // $55,000.00 in cents
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("userId", userId);
      expect(response.body).toHaveProperty("symbolId", symbolId);
      expect(response.body).toHaveProperty("type", OrderType.BUY);
      expect(response.body).toHaveProperty("price", 5000000);
      expect(response.body).toHaveProperty("quantity", 0.1);
      expect(response.body).toHaveProperty("isShort", false);
      expect(response.body).toHaveProperty("stopLoss", 4800000);
      expect(response.body).toHaveProperty("takeProfit", 5500000);
      expect(response.body).toHaveProperty("status", OrderStatus.OPEN);

      // Save order ID for later tests
      orderId = response.body.id;
    });

    it("should place a new sell order", async () => {
      const response = await request
        .post("/api/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          symbolId,
          type: OrderType.SELL,
          price: 5000000, // $50,000.00 in cents
          quantity: 0.05, // 0.05 BTC
          isShort: true,
          stopLoss: 5200000, // $52,000.00 in cents
          takeProfit: 4500000, // $45,000.00 in cents
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("type", OrderType.SELL);
      expect(response.body).toHaveProperty("isShort", true);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request.post("/api/orders").send({
        symbolId,
        type: OrderType.BUY,
        price: 5000000,
        quantity: 0.1,
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 if required fields are missing", async () => {
      const response = await request
        .post("/api/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          // Missing symbolId
          type: OrderType.BUY,
          price: 5000000,
          quantity: 0.1,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/orders", () => {
    it("should get all orders for the authenticated user", async () => {
      const response = await request
        .get("/api/orders")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0]).toHaveProperty("id");
      expect(response.body[0]).toHaveProperty("userId", userId);
      expect(response.body[0]).toHaveProperty("symbolId");
      expect(response.body[0]).toHaveProperty("type");
      expect(response.body[0]).toHaveProperty("price");
      expect(response.body[0]).toHaveProperty("quantity");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request.get("/api/orders");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/orders/:orderId", () => {
    it("should cancel an existing order", async () => {
      const response = await request
        .delete(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Order cancelled successfully"
      );
    });

    it("should return 404 if order does not exist", async () => {
      const response = await request
        .delete("/api/orders/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request.delete(`/api/orders/${orderId}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/orders/portfolio", () => {
    it("should get user portfolio information", async () => {
      const response = await request
        .get("/api/orders/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("balance");
      expect(response.body.balance).toHaveProperty("total");
      expect(response.body.balance).toHaveProperty("available");
      expect(response.body.balance).toHaveProperty("reserved");
      expect(response.body).toHaveProperty("openOrders");
      expect(response.body.openOrders).toBeInstanceOf(Array);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request.get("/api/orders/portfolio");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });
});
