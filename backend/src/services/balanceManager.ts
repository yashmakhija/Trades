import { EventEmitter } from "events";
import { broadcastBalanceUpdate } from "./webSocketService";
import { prisma } from "../server";

/**
 * Balance Manager Service
 *
 * Handles user balance operations including checking if a user has sufficient balance,
 * reserving balance for pending orders, and updating balance when orders are executed or canceled.
 */
class BalanceManager extends EventEmitter {
  private reservedBalances: Map<string, Map<string, number>> = new Map();

  constructor() {
    super();
  }

  /**
   * Check if a user has enough available balance for an order
   *
   * @param userId User ID
   * @param orderCost Cost of the order
   * @returns Whether the user has enough balance
   */
  async canPlaceOrder(userId: string, orderCost: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usdcBalance: true },
      });

      if (!user) return false;

      // Get total reserved balance
      const reservedBalance = this.getTotalReservedBalance(userId);

      // Available balance = total balance - reserved balance
      const availableBalance = user.usdcBalance - reservedBalance;

      return availableBalance >= orderCost;
    } catch (error) {
      console.error(`Error checking balance for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Reserve balance for an order
   *
   * @param userId User ID
   * @param orderId Order ID
   * @param amount Amount to reserve
   */
  reserveBalance(userId: string, orderId: string, amount: number): void {
    if (!this.reservedBalances.has(userId)) {
      this.reservedBalances.set(userId, new Map());
    }

    this.reservedBalances.get(userId)!.set(orderId, amount);

    this.emit("balanceReserved", { userId, orderId, amount });
    console.log(`Reserved ${amount} for order ${orderId} by user ${userId}`);
  }

  /**
   * Release reserved balance for an order
   *
   * @param userId User ID
   * @param orderId Order ID
   * @returns Amount that was released
   */
  releaseBalance(userId: string, orderId: string): number {
    const userReserved = this.reservedBalances.get(userId);
    if (!userReserved) return 0;

    const amount = userReserved.get(orderId) || 0;
    userReserved.delete(orderId);

    this.emit("balanceReleased", { userId, orderId, amount });
    console.log(`Released ${amount} for order ${orderId} by user ${userId}`);

    return amount;
  }

  /**
   * Get total reserved balance for a user
   *
   * @param userId User ID
   * @returns Total reserved balance
   */
  getTotalReservedBalance(userId: string): number {
    const userReserved = this.reservedBalances.get(userId);
    if (!userReserved) return 0;

    let total = 0;
    for (const amount of userReserved.values()) {
      total += amount;
    }

    return total;
  }

  /**
   * Update user balance after order execution
   *
   * @param userId User ID
   * @param orderId Order ID
   * @param pnl Profit/loss
   */
  async updateBalanceAfterExecution(
    userId: string,
    orderId: string,
    pnl: number
  ): Promise<void> {
    try {
      // Release the reserved balance
      const reservedAmount = this.releaseBalance(userId, orderId);

      // Update the user's balance with the PnL
      await prisma.user.update({
        where: { id: userId },
        data: {
          usdcBalance: {
            increment: pnl,
          },
        },
      });

      this.emit("balanceUpdated", { userId, orderId, pnl, reservedAmount });
      console.log(`Updated balance for user ${userId} with PnL ${pnl}`);
    } catch (error) {
      console.error(`Error updating balance for user ${userId}:`, error);
    }
  }

  /**
   * Get user balance
   *
   * @param userId User ID
   * @returns User balance information
   */
  async getUserBalance(
    userId: string
  ): Promise<{ total: number; reserved: number; available: number } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { usdcBalance: true },
      });

      if (!user) return null;

      const reserved = this.getTotalReservedBalance(userId);
      const available = user.usdcBalance - reserved;

      return {
        total: user.usdcBalance,
        reserved,
        available,
      };
    } catch (error) {
      console.error(`Error getting balance for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get statistics about the balance manager
   * Useful for monitoring and debugging
   */
  getStats(): Record<string, any> {
    return {
      usersWithReservedBalance: this.reservedBalances.size,
      totalReservedOrders: Array.from(this.reservedBalances.values()).reduce(
        (acc, map) => acc + map.size,
        0
      ),
    };
  }
}

// Singleton instance
export const balanceManager = new BalanceManager();
