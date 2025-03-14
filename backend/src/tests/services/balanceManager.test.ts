/**
 * BalanceManager Service Tests
 *
 * Tests for the BalanceManager service functionality.
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
import { balanceManager } from "../../services/balanceManager";
import { prisma } from "../../server";

// Mock the WebSocket broadcast function
mock.module("../../services/webSocketService", () => ({
  broadcastBalanceUpdate: mock.fn(),
}));

describe("BalanceManager Service", () => {
  let userId: string;
  const orderId = "test-order-id";
  const orderAmount = 500000; // $5,000.00 in cents

  // Set up test data before all tests
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "balance-manager-test@example.com",
        password: await Bun.password.hash("Password123!"),
        name: "Balance Manager Test User",
        usdcBalance: 1000000, // $10,000.00 in cents
      },
    });
    userId = user.id;
  });

  // Clean up test data after all tests
  afterAll(async () => {
    // Delete test user
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });
  });

  // Reset reserved balances before each test
  beforeEach(() => {
    // Release any reserved balances
    balanceManager.releaseBalance(userId, orderId);
  });

  describe("canPlaceOrder", () => {
    it("should return true if user has sufficient balance", async () => {
      const result = await balanceManager.canPlaceOrder(userId, 500000);
      expect(result).toBe(true);
    });

    it("should return false if user has insufficient balance", async () => {
      const result = await balanceManager.canPlaceOrder(userId, 2000000);
      expect(result).toBe(false);
    });

    it("should return false if user does not exist", async () => {
      const result = await balanceManager.canPlaceOrder(
        "non-existent-user",
        500000
      );
      expect(result).toBe(false);
    });

    it("should consider reserved balance when checking", async () => {
      // Reserve some balance
      balanceManager.reserveBalance(userId, orderId, 800000);

      // Now user should have only $2,000 available
      const result = await balanceManager.canPlaceOrder(userId, 300000);
      expect(result).toBe(false);
    });
  });

  describe("reserveBalance and getTotalReservedBalance", () => {
    it("should reserve balance for an order", () => {
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      const reservedBalance = balanceManager.getTotalReservedBalance(userId);
      expect(reservedBalance).toBe(orderAmount);
    });

    it("should accumulate reserved balance for multiple orders", () => {
      balanceManager.reserveBalance(userId, orderId, orderAmount);
      balanceManager.reserveBalance(userId, "another-order-id", 300000);

      const reservedBalance = balanceManager.getTotalReservedBalance(userId);
      expect(reservedBalance).toBe(orderAmount + 300000);
    });

    it("should return 0 for non-existent user", () => {
      const reservedBalance =
        balanceManager.getTotalReservedBalance("non-existent-user");
      expect(reservedBalance).toBe(0);
    });
  });

  describe("releaseBalance", () => {
    it("should release reserved balance for an order", () => {
      // First reserve some balance
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      // Then release it
      const releasedAmount = balanceManager.releaseBalance(userId, orderId);

      expect(releasedAmount).toBe(orderAmount);

      // Verify it's released
      const reservedBalance = balanceManager.getTotalReservedBalance(userId);
      expect(reservedBalance).toBe(0);
    });

    it("should return 0 if no balance was reserved", () => {
      const releasedAmount = balanceManager.releaseBalance(
        userId,
        "non-existent-order"
      );
      expect(releasedAmount).toBe(0);
    });

    it("should return 0 for non-existent user", () => {
      const releasedAmount = balanceManager.releaseBalance(
        "non-existent-user",
        orderId
      );
      expect(releasedAmount).toBe(0);
    });
  });

  describe("updateBalanceAfterExecution", () => {
    it("should update user balance with profit", async () => {
      // First reserve some balance
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      // Execute with profit
      await balanceManager.updateBalanceAfterExecution(userId, orderId, 100000);

      // Verify balance is updated in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usdcBalance: true },
      });

      expect(user).toBeDefined();
      expect(user?.usdcBalance).toBe(1100000); // Initial 1,000,000 + 100,000 profit

      // Verify reserved balance is released
      const reservedBalance = balanceManager.getTotalReservedBalance(userId);
      expect(reservedBalance).toBe(0);
    });

    it("should update user balance with loss", async () => {
      // First reserve some balance
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      // Execute with loss
      await balanceManager.updateBalanceAfterExecution(
        userId,
        orderId,
        -100000
      );

      // Verify balance is updated in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usdcBalance: true },
      });

      expect(user).toBeDefined();
      expect(user?.usdcBalance).toBe(1000000); // Initial 1,100,000 - 100,000 loss
    });
  });

  describe("getUserBalance", () => {
    it("should get user balance information", async () => {
      // Reserve some balance
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      const balance = await balanceManager.getUserBalance(userId);

      expect(balance).toBeDefined();
      expect(balance).toHaveProperty("total", 1000000);
      expect(balance).toHaveProperty("reserved", orderAmount);
      expect(balance).toHaveProperty("available", 1000000 - orderAmount);
    });

    it("should return null for non-existent user", async () => {
      const balance = await balanceManager.getUserBalance("non-existent-user");
      expect(balance).toBeNull();
    });
  });

  describe("getStats", () => {
    it("should return statistics about the balance manager", () => {
      // Reserve some balance to have stats
      balanceManager.reserveBalance(userId, orderId, orderAmount);

      const stats = balanceManager.getStats();

      expect(stats).toBeInstanceOf(Object);
      expect(stats).toHaveProperty("usersWithReservedBalance");
      expect(stats).toHaveProperty("totalReservedOrders");
      expect(stats.usersWithReservedBalance).toBeGreaterThanOrEqual(1);
      expect(stats.totalReservedOrders).toBeGreaterThanOrEqual(1);
    });
  });
});
