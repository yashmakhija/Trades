import { EventEmitter } from "events";
import { broadcastBalanceUpdate } from "./webSocketService";
import { prisma } from "../server";
import { OrderType, OrderStatus } from "@prisma/client";

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  orderId: string;
  pnl: number;
  status: string;
}

interface UserBalance {
  total: number;
  reserved: number;
  available: number;
  positions: Map<string, Position>;
  lastUpdate: Date;
  openOrders: Set<string>;
}

/**
 * Balance Manager Service
 *
 * Handles user balance operations including checking if a user has sufficient balance,
 * reserving balance for pending orders, and updating balance when orders are executed or canceled.
 */
export class BalanceManager extends EventEmitter {
  // In-memory balance cache
  private userBalances: Map<string, UserBalance> = new Map();
  private reservedBalances: Map<string, Map<string, number>> = new Map();

  constructor() {
    super();
    this.initializeBalanceCache();
  }

  private async initializeBalanceCache() {
    try {
      const users = await prisma.user.findMany({
        include: {
          orders: {
            where: { status: "OPEN" },
            include: { symbol: true },
          },
        },
      });

      users.forEach((user) => {
        const positions = new Map<string, Position>();
        const openOrders = new Set<string>();
        let reserved = 0;

        user.orders.forEach((order) => {
          reserved += order.reservedAmount || 0;
          if (order.status === OrderStatus.OPEN) {
            openOrders.add(order.id);
            positions.set(order.id, {
              symbol: order.symbol.name,
              quantity: order.quantity,
              averagePrice: order.price,
              currentPrice: order.symbol.currentPrice || 0,
              orderId: order.id,
              pnl:
                ((order.symbol.currentPrice || 0) - order.price) *
                order.quantity,
              status: order.status,
            });
          }
        });

        this.userBalances.set(user.id, {
          total: user.usdcBalance,
          reserved,
          available: user.usdcBalance - reserved,
          positions,
          lastUpdate: new Date(),
          openOrders,
        });
      });

      console.log("Balance cache initialized");
    } catch (error) {
      console.error("Error initializing balance cache:", error);
    }
  }

  async updateSymbolPrice(symbol: string, newPrice: number) {
    if (!symbol || !newPrice) {
      console.warn(`Invalid symbol or price: ${symbol}, ${newPrice}`);
      return;
    }

    this.userBalances.forEach((balance, userId) => {
      if (!userId) {
        console.warn("Found balance with no userId");
        return;
      }

      let totalPnlChange = 0;

      balance.positions.forEach((position) => {
        if (position.symbol === symbol) {
          const oldPnl = position.pnl;
          position.currentPrice = newPrice;
          position.pnl = (newPrice - position.averagePrice) * position.quantity;
          totalPnlChange += position.pnl - oldPnl;
        }
      });

      if (totalPnlChange !== 0) {
        // Only broadcast if there was a change
        broadcastBalanceUpdate(userId, {
          total: balance.total,
          reserved: balance.reserved,
          available: balance.available,
          positions: Array.from(balance.positions.values()),
          totalValue:
            balance.total +
            Array.from(balance.positions.values()).reduce(
              (sum, pos) => sum + pos.quantity * pos.currentPrice,
              0
            ),
        });
      }
    });
  }

  private broadcastBalanceUpdate(userId: string) {
    const balance = this.userBalances.get(userId);
    if (balance) {
      const positions = Array.from(balance.positions.values());
      const totalPositionValue = positions.reduce(
        (sum, pos) => sum + pos.quantity * pos.currentPrice,
        0
      );
      const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

      broadcastBalanceUpdate(userId, {
        total: balance.total,
        reserved: balance.reserved,
        available: balance.available,
        positions,
        totalPositionValue,
        totalValue: balance.total + totalPositionValue,
        totalPnl,
        openOrdersCount: balance.openOrders.size,
      });
    }
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
  async reserveBalance(
    userId: string,
    orderId: string,
    amount: number
  ): Promise<void> {
    const cachedBalance = this.userBalances.get(userId);
    if (!cachedBalance || cachedBalance.available < amount) {
      throw new Error("Insufficient balance");
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { reservedAmount: amount },
      });

      await tx.user.update({
        where: { id: userId },
        data: { usdcBalance: { decrement: amount } },
      });

      // Update cache
      cachedBalance.total -= amount;
      cachedBalance.reserved += amount;
      cachedBalance.available -= amount;
      cachedBalance.openOrders.add(orderId); // Track new open order
      cachedBalance.lastUpdate = new Date();
    });

    this.broadcastBalanceUpdate(userId);
  }

  /**
   * Release reserved balance for an order
   *
   * @param userId User ID
   * @param orderId Order ID
   * @returns Amount that was released
   */
  async releaseReservedBalance(userId: string, orderId: string): Promise<void> {
    const cachedBalance = this.userBalances.get(userId);
    if (!cachedBalance) return;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { reservedAmount: true },
      });

      if (!order?.reservedAmount) return;

      await tx.order.update({
        where: { id: orderId },
        data: {
          reservedAmount: 0,
          status: OrderStatus.CANCELLED,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { usdcBalance: { increment: order.reservedAmount } },
      });

      // Update cache
      cachedBalance.total += order.reservedAmount;
      cachedBalance.reserved -= order.reservedAmount;
      cachedBalance.available += order.reservedAmount;
      cachedBalance.openOrders.delete(orderId); // Remove from open orders
      cachedBalance.positions.delete(orderId);
      cachedBalance.lastUpdate = new Date();
    });

    this.broadcastBalanceUpdate(userId);
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
   * @param symbol Symbol name
   * @param quantity Order quantity
   * @param price Execution price
   * @param type Order type
   */
  async updateBalanceAfterExecution(
    userId: string,
    orderId: string,
    symbol: string,
    quantity: number,
    price: number,
    type: OrderType
  ): Promise<void> {
    console.log(
      `Updating balance after execution for user ${userId}, order ${orderId}`
    );
    console.log(
      `Order details: symbol=${symbol}, quantity=${quantity}, price=${
        price / 100
      }, type=${type}`
    );

    try {
      // Get the order to calculate PnL
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          price: true,
          quantity: true,
          type: true,
          isShort: true,
          reservedAmount: true,
          exitPrice: true,
          pnl: true,
        },
      });

      if (!order) {
        console.error(`Order ${orderId} not found when updating balance`);
        return;
      }

      console.log(
        `Order found: entry price=${order.price / 100}, exit price=${
          order.exitPrice ? order.exitPrice / 100 : "N/A"
        }, reserved=${order.reservedAmount ? order.reservedAmount / 100 : "N/A"}`
      );

      // Calculate PnL based on entry and exit prices
      let pnl = 0;
      if (order.exitPrice) {
        if (type === OrderType.BUY && !order.isShort) {
          // Long position: profit = (exit price - entry price) * quantity
          pnl = (order.exitPrice - order.price) * order.quantity;
        } else if (type === OrderType.SELL && order.isShort) {
          // Short position: profit = (entry price - exit price) * quantity
          pnl = (order.price - order.exitPrice) * order.quantity;
        }
      }

      console.log(`Calculated PnL: ${pnl / 100} USD`);

      // Get cached balance
      const cachedBalance = this.userBalances.get(userId);
      if (!cachedBalance) {
        console.error(`No cached balance found for user ${userId}`);
        await this.initializeUserBalance(userId);
        return;
      }

      // Update the database with the final balance
      await prisma.$transaction(async (tx) => {
        // Release the reserved amount
        if (
          order.reservedAmount !== null &&
          order.reservedAmount !== undefined
        ) {
          console.log(
            `Releasing reserved amount: ${order.reservedAmount / 100} USD`
          );

          // Update user balance: return reserved amount + add PnL
          await tx.user.update({
            where: { id: userId },
            data: {
              usdcBalance: {
                increment: order.reservedAmount + pnl,
              },
            },
          });

          // Record the balance history
          await tx.balanceHistory.create({
            data: {
              userId,
              orderId,
              amount: pnl,
              type: pnl >= 0 ? "TRADE_CLOSE" : "TRADE_CLOSE",
              description: `Order ${orderId} closed with ${
                pnl >= 0 ? "profit" : "loss"
              } of ${Math.abs(pnl) / 100} USD`,
            },
          });

          console.log(
            `User balance updated in database: returned ${
              order.reservedAmount / 100
            } USD + PnL ${pnl / 100} USD`
          );
        }
      });

      // Update the cache
      if (cachedBalance) {
        // Release the reserved amount
        if (
          order.reservedAmount !== null &&
          order.reservedAmount !== undefined
        ) {
          cachedBalance.reserved -= order.reservedAmount;
          cachedBalance.total += pnl; // Add PnL to total balance
          cachedBalance.available =
            cachedBalance.total - cachedBalance.reserved;
        }

        // Remove from open orders
        cachedBalance.openOrders.delete(orderId);

        // Remove from positions
        cachedBalance.positions.delete(orderId);

        cachedBalance.lastUpdate = new Date();

        console.log(
          `Cache updated: total=${cachedBalance.total / 100}, reserved=${
            cachedBalance.reserved / 100
          }, available=${cachedBalance.available / 100}`
        );
      }

      // Broadcast the updated balance
      this.broadcastBalanceUpdate(userId);

      console.log(
        `Balance update completed for user ${userId}, order ${orderId}`
      );
    } catch (error) {
      console.error(`Error updating balance after execution:`, error);
    }
  }

  /**
   * Get user balance
   *
   * @param userId User ID
   * @returns User balance information
   */
  async getUserBalance(userId: string): Promise<{
    total: number;
    reserved: number;
    available: number;
    positions: Position[];
    totalValue: number;
    totalPnl: number;
    totalPositionValue: number;
    openOrdersCount: number;
  } | null> {
    // Check if userId is valid
    if (!userId) {
      console.warn(
        "getUserBalance called with no userId - returning default balance for anonymous user"
      );
      // Return a default balance for anonymous users (market data only)
      return {
        total: 0,
        reserved: 0,
        available: 0,
        positions: [],
        totalValue: 0,
        totalPnl: 0,
        totalPositionValue: 0,
        openOrdersCount: 0,
      };
    }

    console.log(`Getting balance for user ${userId}`);

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.log(
        `getUserBalance called with invalid userId format: ${userId}`
      );
      return null;
    }

    const cachedBalance = this.userBalances.get(userId);
    if (!cachedBalance) {
      console.log(
        `No cached balance found for user ${userId}, initializing...`
      );
      // If not in cache, fetch from DB and cache it
      const result = await this.initializeUserBalance(userId);
      if (!result) {
        console.warn(`Failed to initialize balance for user ${userId}`);
        return null;
      }
      console.log(`Balance initialized for user ${userId}, retrieving...`);
      return this.getUserBalance(userId);
    }

    console.log(
      `Found cached balance for user ${userId}: total=${cachedBalance.total}, available=${cachedBalance.available}`
    );

    const positions = Array.from(cachedBalance.positions.values());
    const totalPositionValue = positions.reduce(
      (sum, pos) => sum + pos.quantity * pos.currentPrice,
      0
    );

    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

    return {
      total: cachedBalance.total,
      reserved: cachedBalance.reserved,
      available: cachedBalance.available,
      positions,
      totalValue: cachedBalance.total + totalPositionValue,
      totalPnl,
      totalPositionValue,
      openOrdersCount: cachedBalance.openOrders.size,
    };
  }

  private async initializeUserBalance(userId: string) {
    try {
      if (!userId) {
        console.error(
          `Cannot initialize balance for invalid user ID: ${userId}`
        );
        return null;
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        console.error(`Invalid user ID format: ${userId}`);
        return null;
      }

      console.log(`BalanceManager: Initializing balance for user ${userId}`);

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          orders: {
            where: {
              status: "OPEN",
            },
            include: {
              symbol: true,
            },
          },
        },
      });

      if (!user) {
        console.error(`User not found for ID: ${userId}`);
        return null;
      }

      console.log(`Found user ${userId} with balance: ${user.usdcBalance}`);

      const positions = new Map<string, Position>();
      const openOrders = new Set<string>();
      let reserved = 0;

      for (const order of user.orders) {
        openOrders.add(order.id);
        const symbolName = order.symbol.name;
        const position = positions.get(symbolName);

        if (position) {
          position.quantity +=
            order.type === "BUY" ? order.quantity : -order.quantity;
          position.averagePrice = order.price;
          position.currentPrice = order.price;
          position.pnl = 0;
          position.status = order.status;
        } else {
          positions.set(symbolName, {
            symbol: symbolName,
            quantity: order.type === "BUY" ? order.quantity : -order.quantity,
            averagePrice: order.price,
            currentPrice: order.price,
            orderId: order.id,
            pnl: 0,
            status: order.status,
          });
        }

        if (order.reservedAmount) {
          reserved += order.reservedAmount;
        }
      }

      console.log(
        `User ${userId} has ${openOrders.size} open orders and ${reserved} reserved balance`
      );

      this.userBalances.set(userId, {
        total: user.usdcBalance,
        reserved: reserved,
        available: user.usdcBalance - reserved,
        positions,
        lastUpdate: new Date(),
        openOrders,
      });

      console.log(
        `Balance initialized for user ${userId}: total=${
          user.usdcBalance
        }, available=${user.usdcBalance - reserved}`
      );
      return this.userBalances.get(userId);
    } catch (error) {
      console.error(`Error initializing balance for user ${userId}:`, error);
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

  async updateBalance(
    userId: string,
    amount: number,
    type: "INCREASE" | "DECREASE"
  ): Promise<void> {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          usdcBalance: {
            [type === "INCREASE" ? "increment" : "decrement"]: amount,
          },
        },
      });
    } catch (error) {
      console.error("Error updating balance:", error);
      throw error;
    }
  }
}

// Singleton instance
export const balanceManager = new BalanceManager();
