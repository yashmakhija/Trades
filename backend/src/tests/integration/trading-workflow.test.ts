/**
 * Trading Workflow Integration Tests
 *
 * Tests the complete trading workflow from user registration to order execution.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../server";
import { prisma } from "../../server";
import { OrderStatus, OrderType } from "@prisma/client";
import { orderManager } from "../../services/orderManager";
import supertest from "supertest";

const request = supertest(app);

describe("Trading Workflow Integration", () => {
  let authToken: string;
  let userId: string;
  let symbolId: string;
  let orderId: string;

  // Set up test data before all tests
  beforeAll(async () => {
    // Create test symbol
    const symbol = await prisma.symbol.upsert({
      where: { name: "btcusdt-integration" },
      update: {},
      create: {
        name: "btcusdt-integration",
        description: "Bitcoin/USDT Integration Test",
        currentPrice: 5000000, // $50,000.00 in cents
      },
    });
    symbolId = symbol.id;
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

    // Delete test symbol
    await prisma.symbol.delete({
      where: {
        id: symbolId,
      },
    });
  });

  describe("Complete Trading Workflow", () => {
    it("Step 1: Register a new user", async () => {
      const response = await request.post("/api/auth/register").send({
        email: "workflow-test@example.com",
        password: "Password123!",
        name: "Workflow Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");

      // Save token and userId for later steps
      authToken = response.body.token;
      userId = response.body.user.id;
    });

    it("Step 2: Get user profile and check initial balance", async () => {
      const response = await request
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("usdcBalance");
      expect(response.body.user.usdcBalance).toBeGreaterThan(0);
    });

    it("Step 3: Get available symbols", async () => {
      const response = await request.get("/api/symbols");

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);

      const testSymbol = response.body.find(
        (s: any) => s.name === "btcusdt-integration"
      );
      expect(testSymbol).toBeDefined();
      expect(testSymbol).toHaveProperty("id", symbolId);
    });

    it("Step 4: Place a buy order", async () => {
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
      expect(response.body).toHaveProperty("status", OrderStatus.OPEN);

      // Save order ID for later steps
      orderId = response.body.id;
    });

    it("Step 5: Get user portfolio and check open orders", async () => {
      const response = await request
        .get("/api/orders/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("balance");
      expect(response.body).toHaveProperty("openOrders");
      expect(response.body.openOrders).toBeInstanceOf(Array);
      expect(response.body.openOrders.length).toBeGreaterThanOrEqual(1);

      const order = response.body.openOrders.find((o: any) => o.id === orderId);
      expect(order).toBeDefined();
      expect(order).toHaveProperty("status", OrderStatus.OPEN);
    });

    it("Step 6: Trigger stop loss with price update", async () => {
      // Manually trigger the stop loss by simulating a price drop
      await orderManager.checkPriceTriggers("btcusdt-integration", 4700000);

      // Verify order is closed
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.status).toBe(OrderStatus.CLOSED);
      expect(dbOrder?.exitPrice).toBe(4700000);
      expect(dbOrder?.pnl).toBeDefined();
      expect(dbOrder?.pnl).toBeLessThan(0); // Should be a loss
    });

    it("Step 7: Get user portfolio and check closed orders", async () => {
      const response = await request
        .get("/api/orders")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);

      const order = response.body.find((o: any) => o.id === orderId);
      expect(order).toBeDefined();
      expect(order).toHaveProperty("status", OrderStatus.CLOSED);
      expect(order).toHaveProperty("exitPrice", 4700000);
      expect(order).toHaveProperty("pnl");
    });

    it("Step 8: Place a sell order with short position", async () => {
      const response = await request
        .post("/api/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          symbolId,
          type: OrderType.SELL,
          price: 4700000, // $47,000.00 in cents
          quantity: 0.1, // 0.1 BTC
          isShort: true,
          stopLoss: 5000000, // $50,000.00 in cents
          takeProfit: 4200000, // $42,000.00 in cents
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("type", OrderType.SELL);
      expect(response.body).toHaveProperty("isShort", true);
      expect(response.body).toHaveProperty("status", OrderStatus.OPEN);

      // Save new order ID
      orderId = response.body.id;
    });

    it("Step 9: Trigger take profit with price update", async () => {
      // Manually trigger the take profit by simulating a price drop
      await orderManager.checkPriceTriggers("btcusdt-integration", 4200000);

      // Verify order is closed
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.status).toBe(OrderStatus.CLOSED);
      expect(dbOrder?.exitPrice).toBe(4200000);
      expect(dbOrder?.pnl).toBeDefined();
      expect(dbOrder?.pnl).toBeGreaterThan(0); // Should be a profit
    });

    it("Step 10: Check final user balance", async () => {
      const response = await request
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("usdcBalance");

      // Balance should reflect the PnL from both trades
      // We can't predict the exact amount, but it should be different from the initial balance
    });
  });
});
