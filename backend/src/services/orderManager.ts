import { OrderStatus, OrderType } from "@prisma/client";
import { EventEmitter } from "events";
import {
  broadcastOrderUpdate,
  broadcastBalanceUpdate,
  broadcastTradeAnalytics,
} from "./webSocketService";
import { balanceManager } from "./balanceManager";
import { prisma } from "../lib/prisma";
import { Order } from "../types/binance";
import { tradeAnalytics } from "./tradeAnalyticsService";

/**
 * OrderManager handles in-memory order management for the trading platform.
 * Maintains collections of open orders, tracks stop-loss and take-profit orders,
 * monitors price updates to trigger order execution, and updates user balances.
 */
class OrderManager extends EventEmitter {
  private openOrders: Map<string, Order> = new Map();
  private userOrders: Map<string, Set<string>> = new Map();
  private stopLossOrders: Map<string, Map<string, Order>> = new Map();
  private takeProfitOrders: Map<string, Map<string, Order>> = new Map();

  constructor() {
    super();
    this.loadExistingOrders().catch((err) => {
      console.error("Failed to load existing orders:", err);
    });
  }

  /**
   * Add a new order to the in-memory system
   *
   * @param orderData Order data without id, createdAt, and status
   * @returns The created order
   */
  async addOrder(
    orderData: Omit<Order, "id" | "createdAt" | "status">
  ): Promise<Order> {
    try {
      // Create order in database
      const order = await prisma.order.create({
        data: {
          userId: orderData.userId,
          symbolId: orderData.symbolId,
          price: orderData.price,
          quantity: orderData.quantity,
          type: orderData.type,
          isShort: orderData.isShort,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          status: OrderStatus.OPEN,
        },
        include: {
          symbol: true,
        },
      });

      // Add to in-memory maps
      const orderObj: Order = {
        ...order,
        symbolName: order.symbol.name,
      };

      this.openOrders.set(order.id, orderObj);

      // Add to user orders map
      if (!this.userOrders.has(order.userId)) {
        this.userOrders.set(order.userId, new Set());
      }
      this.userOrders.get(order.userId)!.add(order.id);

      // Add to stop loss map if applicable
      if (order.stopLoss) {
        if (!this.stopLossOrders.has(orderObj.symbolName)) {
          this.stopLossOrders.set(orderObj.symbolName, new Map());
        }
        this.stopLossOrders.get(orderObj.symbolName)!.set(order.id, orderObj);
      }

      // Add to take profit map if applicable
      if (order.takeProfit) {
        if (!this.takeProfitOrders.has(orderObj.symbolName)) {
          this.takeProfitOrders.set(orderObj.symbolName, new Map());
        }
        this.takeProfitOrders.get(orderObj.symbolName)!.set(order.id, orderObj);
      }

      // Emit order created event
      this.emit("orderCreated", orderObj);

      console.log(
        `Order created: ${order.id} for ${orderObj.symbolName} by user ${order.userId}`
      );

      return orderObj;
    } catch (error) {
      console.error("Error adding order:", error);
      throw new Error("Failed to add order");
    }
  }

  /**
   * Cancel an existing order
   *
   * @param orderId ID of the order to cancel
   * @param userId ID of the user who owns the order
   * @returns Whether the cancellation was successful
   */
  async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    try {
      const order = this.openOrders.get(orderId);

      if (!order || order.userId !== userId) {
        return false;
      }

      // Update order in database
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          closedAt: new Date(),
        },
      });

      // Remove from in-memory maps
      this.openOrders.delete(orderId);
      this.userOrders.get(userId)?.delete(orderId);

      // Remove from stop loss and take profit maps
      if (order.stopLoss) {
        this.stopLossOrders.get(order.symbolName)?.delete(orderId);
      }

      if (order.takeProfit) {
        this.takeProfitOrders.get(order.symbolName)?.delete(orderId);
      }

      // Emit order cancelled event
      this.emit("orderCancelled", { ...order, status: OrderStatus.CANCELLED });

      console.log(`Order cancelled: ${orderId}`);

      return true;
    } catch (error) {
      console.error("Error cancelling order:", error);
      return false;
    }
  }

  /**
   * Check price triggers for a symbol
   * This is called whenever a new price update is received
   *
   * @param symbol Symbol name
   * @param price Current price
   */
  async checkPriceTriggers(symbol: string, price: number): Promise<void> {
    // Check stop loss orders
    const stopLossMap = this.stopLossOrders.get(symbol);
    if (stopLossMap) {
      for (const [orderId, order] of stopLossMap.entries()) {
        if (this.shouldTriggerStopLoss(order, price)) {
          await this.executeOrder(orderId, price, "STOP_LOSS");
        }
      }
    }

    // Check take profit orders
    const takeProfitMap = this.takeProfitOrders.get(symbol);
    if (takeProfitMap) {
      for (const [orderId, order] of takeProfitMap.entries()) {
        if (this.shouldTriggerTakeProfit(order, price)) {
          await this.executeOrder(orderId, price, "TAKE_PROFIT");
        }
      }
    }
  }

  /**
   * Determine if a stop loss should be triggered
   *
   * @param order Order to check
   * @param currentPrice Current price
   * @returns Whether the stop loss should be triggered
   */
  private shouldTriggerStopLoss(order: Order, currentPrice: number): boolean {
    if (!order.stopLoss) return false;

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position - trigger if price falls below stop loss
      return currentPrice <= order.stopLoss;
    } else {
      // Short position - trigger if price rises above stop loss
      return currentPrice >= order.stopLoss;
    }
  }

  /**
   * Determine if a take profit should be triggered
   *
   * @param order Order to check
   * @param currentPrice Current price
   * @returns Whether the take profit should be triggered
   */
  private shouldTriggerTakeProfit(order: Order, currentPrice: number): boolean {
    if (!order.takeProfit) return false;

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position - trigger if price rises above take profit
      return currentPrice >= order.takeProfit;
    } else {
      // Short position - trigger if price falls below take profit
      return currentPrice <= order.takeProfit;
    }
  }

  /**
   * Execute an order at a specific price
   *
   * @param orderId ID of the order to execute
   * @param price Execution price
   * @param triggerType What triggered the execution
   */
  private async executeOrder(
    orderId: string,
    price: number,
    triggerType: "MARKET" | "STOP_LOSS" | "TAKE_PROFIT"
  ): Promise<void> {
    try {
      const order = this.openOrders.get(orderId);
      if (!order) return;

      // Calculate PnL
      const pnl = this.calculatePnL(order, price);

      // Update user balance
      await this.updateUserBalance(order.userId, order, price, pnl);

      // Update order in database
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CLOSED,
          exitPrice: price,
          pnl,
          closedAt: new Date(),
        },
      });

      // Remove from in-memory maps
      this.openOrders.delete(orderId);
      this.userOrders.get(order.userId)?.delete(orderId);

      if (order.stopLoss) {
        this.stopLossOrders.get(order.symbolName)?.delete(orderId);
      }

      if (order.takeProfit) {
        this.takeProfitOrders.get(order.symbolName)?.delete(orderId);
      }

      const executedOrder = {
        ...order,
        status: OrderStatus.CLOSED,
        exitPrice: price,
        pnl,
        closedAt: new Date(),
      };

      // Emit order executed event
      this.emit("orderExecuted", executedOrder);

      // Broadcast order update via WebSocket
      broadcastOrderUpdate(order.userId, {
        id: orderId,
        status: OrderStatus.CLOSED,
        exitPrice: price,
        pnl,
        symbolName: order.symbolName,
        type: order.type,
        price: order.price,
        quantity: order.quantity,
        isShort: order.isShort,
      });

      // Get updated trade analytics and broadcast
      const [userStats, symbolStats, dailyPnL] = await Promise.all([
        tradeAnalytics.getUserStats(order.userId),
        tradeAnalytics.getSymbolStats(order.userId),
        tradeAnalytics.getDailyPnL(
          order.userId,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          new Date()
        ),
      ]);

      broadcastTradeAnalytics(order.userId, {
        userStats,
        symbolStats,
        dailyPnL,
      });

      console.log(`Order ${orderId} executed at ${price} (${triggerType})`);
    } catch (error) {
      console.error(`Error executing order ${orderId}:`, error);
    }
  }

  /**
   * Calculate profit/loss for an order
   *
   * @param order Order to calculate PnL for
   * @param exitPrice Exit price
   * @returns Calculated PnL
   */
  private calculatePnL(order: Order, exitPrice: number): number {
    const entryValue = order.price * order.quantity;
    const exitValue = exitPrice * order.quantity;

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position: profit when exit price > entry price
      return exitValue - entryValue;
    } else {
      // Short position: profit when entry price > exit price
      return entryValue - exitValue;
    }
  }

  /**
   * Update user balance after order execution
   *
   * @param userId User ID
   * @param order Executed order
   * @param exitPrice Exit price
   * @param pnl Profit/loss
   */
  private async updateUserBalance(
    userId: string,
    order: Order,
    exitPrice: number,
    pnl: number
  ): Promise<void> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          usdcBalance: {
            increment: pnl,
          },
        },
      });

      // Broadcast balance update via WebSocket
      broadcastBalanceUpdate(userId, {
        total: updatedUser.usdcBalance,
        available: updatedUser.usdcBalance, // This is simplified, in a real app you'd calculate available balance
        reserved: 0, // This is simplified, in a real app you'd calculate reserved balance
      });
    } catch (error) {
      console.error(`Error updating balance for user ${userId}:`, error);
    }
  }

  /**
   * Get all open orders for a user
   *
   * @param userId User ID
   * @returns Array of open orders
   */
  getUserOpenOrders(userId: string): Order[] {
    const orderIds = this.userOrders.get(userId);
    if (!orderIds) return [];

    const orders: Order[] = [];
    for (const orderId of orderIds) {
      const order = this.openOrders.get(orderId);
      if (order) orders.push(order);
    }

    return orders;
  }

  /**
   * Get stop loss orders for a symbol
   *
   * @param symbol Symbol name
   * @returns Array of stop loss orders
   */
  getStopLossOrders(symbol: string): Order[] {
    const orderMap = this.stopLossOrders.get(symbol);
    if (!orderMap) return [];
    return Array.from(orderMap.values());
  }

  /**
   * Get take profit orders for a symbol
   *
   * @param symbol Symbol name
   * @returns Array of take profit orders
   */
  getTakeProfitOrders(symbol: string): Order[] {
    const orderMap = this.takeProfitOrders.get(symbol);
    if (!orderMap) return [];
    return Array.from(orderMap.values());
  }

  /**
   * Load existing open orders from database on startup
   * This ensures that orders persist across server restarts
   */
  async loadExistingOrders(): Promise<void> {
    try {
      const openOrders = await prisma.order.findMany({
        where: {
          status: OrderStatus.OPEN,
        },
        include: {
          symbol: true,
        },
      });

      console.log(`Loading ${openOrders.length} existing open orders`);

      for (const order of openOrders) {
        const orderObj: Order = {
          ...order,
          symbolName: order.symbol.name,
        };

        this.openOrders.set(order.id, orderObj);

        // Add to user orders map
        if (!this.userOrders.has(order.userId)) {
          this.userOrders.set(order.userId, new Set());
        }
        this.userOrders.get(order.userId)!.add(order.id);

        // Add to stop loss map if applicable
        if (order.stopLoss) {
          if (!this.stopLossOrders.has(orderObj.symbolName)) {
            this.stopLossOrders.set(orderObj.symbolName, new Map());
          }
          this.stopLossOrders.get(orderObj.symbolName)!.set(order.id, orderObj);
        }

        // Add to take profit map if applicable
        if (order.takeProfit) {
          if (!this.takeProfitOrders.has(orderObj.symbolName)) {
            this.takeProfitOrders.set(orderObj.symbolName, new Map());
          }
          this.takeProfitOrders
            .get(orderObj.symbolName)!
            .set(order.id, orderObj);
        }
      }

      console.log("Existing orders loaded successfully");
    } catch (error) {
      console.error("Error loading existing orders:", error);
    }
  }

  /**
   * Get statistics about the order manager
   * Useful for monitoring and debugging
   */
  getStats(): Record<string, any> {
    return {
      openOrdersCount: this.openOrders.size,
      userOrdersCount: this.userOrders.size,
      stopLossSymbolsCount: this.stopLossOrders.size,
      takeProfitSymbolsCount: this.takeProfitOrders.size,
      stopLossOrdersCount: Array.from(this.stopLossOrders.values()).reduce(
        (acc, map) => acc + map.size,
        0
      ),
      takeProfitOrdersCount: Array.from(this.takeProfitOrders.values()).reduce(
        (acc, map) => acc + map.size,
        0
      ),
    };
  }
}

// Singleton instance
export const orderManager = new OrderManager();
