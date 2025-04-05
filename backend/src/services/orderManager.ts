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
      // Calculate required balance
      const requiredAmount = orderData.price * orderData.quantity;

      // Create order in database first to get the orderId
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
          reservedAmount: requiredAmount, // Store the reserved amount
        },
        include: {
          symbol: true,
        },
      });

      // Reserve the balance using the order ID
      await balanceManager.reserveBalance(
        orderData.userId,
        order.id,
        requiredAmount
      );

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
      throw error;
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

      // Release the reserved balance - this will handle broadcasting balance updates
      await balanceManager.releaseReservedBalance(userId, orderId);

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

      // Broadcast order update only
      broadcastOrderUpdate(userId, {
        id: orderId,
        status: OrderStatus.CANCELLED,
        symbolName: order.symbolName,
        type: order.type,
        price: order.price,
        quantity: order.quantity,
        isShort: order.isShort,
      });

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
    // Log the check operation
    console.log(
      `Checking price triggers for ${symbol} at price ${price / 100} USD`
    );

    // Check if we have any orders for this symbol
    const stopLossMap = this.stopLossOrders.get(symbol);
    const takeProfitMap = this.takeProfitOrders.get(symbol);

    if (!stopLossMap && !takeProfitMap) {
      // No orders with stop-loss or take-profit for this symbol
      return;
    }

    console.log(
      `Found ${stopLossMap?.size || 0} stop-loss orders and ${
        takeProfitMap?.size || 0
      } take-profit orders for ${symbol}`
    );

    // Check stop loss orders
    if (stopLossMap && stopLossMap.size > 0) {
      console.log(
        `Checking ${stopLossMap.size} stop-loss orders for ${symbol}`
      );

      for (const [orderId, order] of stopLossMap.entries()) {
        console.log(
          `Checking stop-loss for order ${orderId}: current price ${
            price / 100
          }, stop-loss ${order.stopLoss! / 100}`
        );

        if (this.shouldTriggerStopLoss(order, price)) {
          console.log(
            `🔴 STOP-LOSS TRIGGERED for order ${orderId} at price ${
              price / 100
            }`
          );
          await this.executeOrder(orderId, price, "STOP_LOSS");
        }
      }
    }

    // Check take profit orders
    if (takeProfitMap && takeProfitMap.size > 0) {
      console.log(
        `Checking ${takeProfitMap.size} take-profit orders for ${symbol}`
      );

      for (const [orderId, order] of takeProfitMap.entries()) {
        console.log(
          `Checking take-profit for order ${orderId}: current price ${
            price / 100
          }, take-profit ${order.takeProfit! / 100}`
        );

        if (this.shouldTriggerTakeProfit(order, price)) {
          console.log(
            `🟢 TAKE-PROFIT TRIGGERED for order ${orderId} at price ${
              price / 100
            }`
          );
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

    // Log the comparison values
    console.log(
      `Stop-loss check for ${order.id}: type=${order.type}, isShort=${
        order.isShort
      }, currentPrice=${currentPrice / 100}, stopLoss=${order.stopLoss / 100}`
    );

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position - trigger if price falls below stop loss
      const shouldTrigger = currentPrice <= order.stopLoss;
      if (shouldTrigger) {
        console.log(
          `Stop-loss triggered for LONG position: ${currentPrice / 100} <= ${
            order.stopLoss / 100
          }`
        );
      }
      return shouldTrigger;
    } else {
      // Short position - trigger if price rises above stop loss
      const shouldTrigger = currentPrice >= order.stopLoss;
      if (shouldTrigger) {
        console.log(
          `Stop-loss triggered for SHORT position: ${currentPrice / 100} >= ${
            order.stopLoss / 100
          }`
        );
      }
      return shouldTrigger;
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

    // Log the comparison values
    console.log(
      `Take-profit check for ${order.id}: type=${order.type}, isShort=${
        order.isShort
      }, currentPrice=${currentPrice / 100}, takeProfit=${
        order.takeProfit / 100
      }`
    );

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position - trigger if price rises above take profit
      const shouldTrigger = currentPrice >= order.takeProfit;
      if (shouldTrigger) {
        console.log(
          `Take-profit triggered for LONG position: ${currentPrice / 100} >= ${
            order.takeProfit / 100
          }`
        );
      }
      return shouldTrigger;
    } else {
      // Short position - trigger if price falls below take profit
      const shouldTrigger = currentPrice <= order.takeProfit;
      if (shouldTrigger) {
        console.log(
          `Take-profit triggered for SHORT position: ${currentPrice / 100} <= ${
            order.takeProfit / 100
          }`
        );
      }
      return shouldTrigger;
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
      console.log(
        `⚡ Executing order ${orderId} at price ${price / 100} (${triggerType})`
      );

      const order = this.openOrders.get(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found in openOrders map`);
        return;
      }

      console.log(
        `Order details: ${JSON.stringify({
          id: order.id,
          symbol: order.symbolName,
          type: order.type,
          isShort: order.isShort,
          price: order.price / 100,
          quantity: order.quantity,
          stopLoss: order.stopLoss ? order.stopLoss / 100 : null,
          takeProfit: order.takeProfit ? order.takeProfit / 100 : null,
        })}`
      );

      // Calculate PnL
      const pnl = this.calculatePnL(order, price);
      console.log(`Calculated PnL: ${pnl / 100} USD`);

      try {
        // Update order in database first
        const updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CLOSED,
            exitPrice: price,
            pnl,
            closedAt: new Date(),
          },
        });

        console.log(
          `Order updated in database: ${updatedOrder.id}, status: ${updatedOrder.status}`
        );
      } catch (dbError) {
        console.error(`Database error updating order ${orderId}:`, dbError);
        throw dbError; // Re-throw to be caught by outer try/catch
      }

      try {
        // Update balance manager with position info - this will handle broadcasting balance updates
        await balanceManager.updateBalanceAfterExecution(
          order.userId,
          orderId,
          order.symbolName,
          order.quantity,
          price,
          order.type
        );

        console.log(
          `Balance updated for user ${order.userId} after order execution`
        );
      } catch (balanceError) {
        console.error(
          `Error updating balance for order ${orderId}:`,
          balanceError
        );
        // Continue execution even if balance update fails - we'll need to handle this manually
      }

      // Remove from in-memory maps
      this.openOrders.delete(orderId);
      console.log(`Removed order ${orderId} from openOrders map`);

      if (this.userOrders.has(order.userId)) {
        this.userOrders.get(order.userId)?.delete(orderId);
        console.log(
          `Removed order ${orderId} from userOrders map for user ${order.userId}`
        );
      }

      if (order.stopLoss && this.stopLossOrders.has(order.symbolName)) {
        this.stopLossOrders.get(order.symbolName)?.delete(orderId);
        console.log(
          `Removed order ${orderId} from stopLossOrders map for symbol ${order.symbolName}`
        );
      }

      if (order.takeProfit && this.takeProfitOrders.has(order.symbolName)) {
        this.takeProfitOrders.get(order.symbolName)?.delete(orderId);
        console.log(
          `Removed order ${orderId} from takeProfitOrders map for symbol ${order.symbolName}`
        );
      }

      // Broadcast order update via WebSocket
      try {
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

        console.log(`Order update broadcasted to user ${order.userId}`);
      } catch (broadcastError) {
        console.error(
          `Error broadcasting order update for ${orderId}:`,
          broadcastError
        );
        // Continue execution even if broadcast fails
      }

      // Get updated trade analytics and broadcast
      try {
        const [userStats, symbolStats, dailyPnL] = await Promise.all([
          tradeAnalytics.getUserStats(order.userId),
          tradeAnalytics.getSymbolStats(order.userId),
          tradeAnalytics.getDailyPnL(
            order.userId,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date()
          ),
        ]);

        broadcastTradeAnalytics(order.userId, {
          userStats,
          symbolStats,
          dailyPnL,
        });

        console.log(`Trade analytics broadcasted to user ${order.userId}`);
      } catch (analyticsError) {
        console.error(
          `Error processing trade analytics for order ${orderId}:`,
          analyticsError
        );
        // Continue execution even if analytics fails
      }

      console.log(
        `✅ Order ${orderId} successfully executed at ${
          price / 100
        } (${triggerType})`
      );
    } catch (error) {
      console.error(`❌ Error executing order ${orderId}:`, error);
    }
  }

  /**
   * Calculate profit/loss for an order
   *
   * @param order Order to calculate PnL for
   * @param exitPrice Exit price
   * @returns PnL in cents
   */
  private calculatePnL(order: Order, exitPrice: number): number {
    console.log(`Calculating PnL for order ${order.id}:`);
    console.log(`- Entry price: ${order.price / 100} USD`);
    console.log(`- Exit price: ${exitPrice / 100} USD`);
    console.log(`- Quantity: ${order.quantity}`);
    console.log(`- Type: ${order.type}`);
    console.log(`- Is short: ${order.isShort}`);

    let pnl = 0;

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long position: profit = (exit price - entry price) * quantity
      pnl = (exitPrice - order.price) * order.quantity;
      console.log(
        `Long position PnL calculation: (${exitPrice / 100} - ${
          order.price / 100
        }) * ${order.quantity} = ${pnl / 100} USD`
      );
    } else if (order.type === OrderType.SELL && order.isShort) {
      // Short position: profit = (entry price - exit price) * quantity
      pnl = (order.price - exitPrice) * order.quantity;
      console.log(
        `Short position PnL calculation: (${order.price / 100} - ${
          exitPrice / 100
        }) * ${order.quantity} = ${pnl / 100} USD`
      );
    } else {
      console.warn(
        `Unexpected order type/isShort combination: type=${order.type}, isShort=${order.isShort}`
      );
    }

    console.log(`Final PnL: ${pnl / 100} USD`);
    return pnl;
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
   * Get an order by its ID
   *
   * @param orderId ID of the order to retrieve
   * @returns The order or undefined if not found
   */
  getOrderById(orderId: string): Order | undefined {
    return this.openOrders.get(orderId);
  }

  /**
   * Remove an order from all in-memory maps
   *
   * @param orderId ID of the order to remove
   * @param userId ID of the user who owns the order
   */
  removeOrder(orderId: string, userId: string): void {
    const order = this.openOrders.get(orderId);
    if (!order) return;

    // Remove from in-memory maps
    this.openOrders.delete(orderId);
    this.userOrders.get(userId)?.delete(orderId);

    // Remove from stop loss and take profit maps
    if (order.stopLoss && this.stopLossOrders.has(order.symbolName)) {
      this.stopLossOrders.get(order.symbolName)?.delete(orderId);
    }

    if (order.takeProfit && this.takeProfitOrders.has(order.symbolName)) {
      this.takeProfitOrders.get(order.symbolName)?.delete(orderId);
    }
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
