/**
 * OrderManager Service Tests
 *
 * Tests for the OrderManager service functionality.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from "bun:test";
import { orderManager } from "../../services/orderManager";
import { prisma } from "../../server";
import { OrderStatus, OrderType } from "@prisma/client";

// Mock the WebSocket broadcast functions
mock.module("../../services/webSocketService", () => ({
  broadcastOrderUpdate: mock.fn(),
  broadcastBalanceUpdate: mock.fn(),
}));

describe("OrderManager Service", () => {
  let userId: string;
  let symbolId: string;
  let orderId: string;

  // Set up test data before all tests
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "order-manager-test@example.com",
        password: await Bun.password.hash("Password123!"),
        name: "Order Manager Test User",
        usdcBalance: 1000000, // $10,000.00 in cents
      },
    });
    userId = user.id;

    // Create test symbol
    const symbol = await prisma.symbol.upsert({
      where: { name: "btcusdt-test" },
      update: {},
      create: {
        name: "btcusdt-test",
        description: "Bitcoin/USDT Test",
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

  describe("addOrder", () => {
    it("should add a new order", async () => {
      const order = await orderManager.addOrder({
        userId,
        symbolId,
        symbolName: "btcusdt-test",
        price: 5000000, // $50,000.00 in cents
        quantity: 0.1, // 0.1 BTC
        type: OrderType.BUY,
        isShort: false,
        stopLoss: 4800000, // $48,000.00 in cents
        takeProfit: 5500000, // $55,000.00 in cents
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.userId).toBe(userId);
      expect(order.symbolId).toBe(symbolId);
      expect(order.price).toBe(5000000);
      expect(order.quantity).toBe(0.1);
      expect(order.type).toBe(OrderType.BUY);
      expect(order.isShort).toBe(false);
      expect(order.stopLoss).toBe(4800000);
      expect(order.takeProfit).toBe(5500000);
      expect(order.status).toBe(OrderStatus.OPEN);

      // Save order ID for later tests
      orderId = order.id;
    });
  });

  describe("getUserOpenOrders", () => {
    it("should get open orders for a user", () => {
      const orders = orderManager.getUserOpenOrders(userId);

      expect(orders).toBeInstanceOf(Array);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders[0].id).toBe(orderId);
      expect(orders[0].userId).toBe(userId);
    });

    it("should return empty array for non-existent user", () => {
      const orders = orderManager.getUserOpenOrders("non-existent-user");

      expect(orders).toBeInstanceOf(Array);
      expect(orders.length).toBe(0);
    });
  });

  describe("getStopLossOrders and getTakeProfitOrders", () => {
    it("should get stop loss orders for a symbol", () => {
      const orders = orderManager.getStopLossOrders("btcusdt-test");

      expect(orders).toBeInstanceOf(Array);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders[0].id).toBe(orderId);
      expect(orders[0].stopLoss).toBe(4800000);
    });

    it("should get take profit orders for a symbol", () => {
      const orders = orderManager.getTakeProfitOrders("btcusdt-test");

      expect(orders).toBeInstanceOf(Array);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders[0].id).toBe(orderId);
      expect(orders[0].takeProfit).toBe(5500000);
    });
  });

  describe("checkPriceTriggers", () => {
    it("should not trigger orders when price is within range", async () => {
      await orderManager.checkPriceTriggers("btcusdt-test", 5000000);

      // Verify order still exists
      const orders = orderManager.getUserOpenOrders(userId);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders[0].id).toBe(orderId);
    });

    it("should trigger stop loss when price drops below threshold", async () => {
      // This should trigger the stop loss
      await orderManager.checkPriceTriggers("btcusdt-test", 4700000);

      // Verify order is closed
      const orders = orderManager.getUserOpenOrders(userId);
      const orderStillExists = orders.some((order) => order.id === orderId);
      expect(orderStillExists).toBe(false);

      // Verify order is updated in database
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.status).toBe(OrderStatus.CLOSED);
      expect(dbOrder?.exitPrice).toBe(4700000);
      expect(dbOrder?.pnl).toBeDefined();
      expect(dbOrder?.closedAt).toBeDefined();
    });
  });

  describe("cancelOrder", () => {
    let newOrderId: string;

    beforeEach(async () => {
      // Create a new order for cancellation test
      const order = await orderManager.addOrder({
        userId,
        symbolId,
        symbolName: "btcusdt-test",
        price: 5000000,
        quantity: 0.1,
        type: OrderType.BUY,
        isShort: false,
      });

      newOrderId = order.id;
    });

    it("should cancel an existing order", async () => {
      const result = await orderManager.cancelOrder(newOrderId, userId);

      expect(result).toBe(true);

      // Verify order is removed from in-memory store
      const orders = orderManager.getUserOpenOrders(userId);
      const orderStillExists = orders.some((order) => order.id === newOrderId);
      expect(orderStillExists).toBe(false);

      // Verify order is updated in database
      const dbOrder = await prisma.order.findUnique({
        where: { id: newOrderId },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.status).toBe(OrderStatus.CANCELLED);
      expect(dbOrder?.closedAt).toBeDefined();
    });

    it("should return false for non-existent order", async () => {
      const result = await orderManager.cancelOrder(
        "non-existent-order",
        userId
      );

      expect(result).toBe(false);
    });

    it("should return false if user does not own the order", async () => {
      const result = await orderManager.cancelOrder(
        newOrderId,
        "wrong-user-id"
      );

      expect(result).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should return statistics about the order manager", () => {
      const stats = orderManager.getStats();

      expect(stats).toBeInstanceOf(Object);
      expect(stats).toHaveProperty("openOrdersCount");
      expect(stats).toHaveProperty("userOrdersCount");
      expect(stats).toHaveProperty("stopLossSymbolsCount");
      expect(stats).toHaveProperty("takeProfitSymbolsCount");
      expect(stats).toHaveProperty("stopLossOrdersCount");
      expect(stats).toHaveProperty("takeProfitOrdersCount");
    });
  });
});
