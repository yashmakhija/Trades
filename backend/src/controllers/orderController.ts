import { Request, Response } from "express";
import { OrderStatus, OrderType } from "@prisma/client";
import { orderManager } from "../services/orderManager";
import { balanceManager } from "../services/balanceManager";
import {
  broadcastOrderUpdate,
  broadcastBalanceUpdate,
} from "../services/webSocketService";
import { prisma } from "../server";

export async function placeOrder(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = req.user.userId;
    const {
      symbolId,
      type,
      price,
      quantity,
      stopLoss,
      takeProfit,
      isShort = false,
    } = req.body;

    if (!symbolId || !type || !price || !quantity) {
      res.status(400).json({
        error: "Missing required fields",
        required: ["symbolId", "type", "price", "quantity"],
      });
      return;
    }

    const symbol = await prisma.symbol.findUnique({
      where: { id: symbolId },
    });

    if (!symbol) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    const orderCost = price * quantity;

    const hasBalance = await balanceManager.canPlaceOrder(userId, orderCost);

    if (!hasBalance) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    balanceManager.reserveBalance(userId, `pending_${Date.now()}`, orderCost);

    try {
      const order = await orderManager.addOrder({
        userId,
        symbolId,
        symbolName: symbol.name,
        price,
        quantity,
        type: type as OrderType,
        isShort,
        stopLoss,
        takeProfit,
      });

      balanceManager.releaseBalance(userId, `pending_${Date.now()}`);
      balanceManager.reserveBalance(userId, order.id, orderCost);

      const updatedBalance = await balanceManager.getUserBalance(userId);

      broadcastOrderUpdate(userId, {
        id: order.id,
        status: order.status,
        type: order.type,
        symbolName: order.symbolName,
        price: order.price,
        quantity: order.quantity,
        isShort: order.isShort,
      });

      if (updatedBalance) {
        broadcastBalanceUpdate(userId, updatedBalance);
      }

      res.status(201).json({
        message: "Order placed successfully",
        order: {
          ...order,
          price: order.price / 100, // Convert to dollars for display
          stopLoss: order.stopLoss ? order.stopLoss / 100 : null,
          takeProfit: order.takeProfit ? order.takeProfit / 100 : null,
        },
      });
    } catch (orderError) {
      balanceManager.releaseBalance(userId, `pending_${Date.now()}`);
      throw orderError;
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
}

export async function cancelOrder(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = req.user.userId;
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({ error: "Order ID is required" });
      return;
    }

    const success = await orderManager.cancelOrder(orderId, userId);

    if (!success) {
      res.status(404).json({ error: "Order not found or already executed" });
      return;
    }

    balanceManager.releaseBalance(userId, orderId);

    const updatedBalance = await balanceManager.getUserBalance(userId);

    broadcastOrderUpdate(userId, {
      id: orderId,
      status: OrderStatus.CANCELLED,
    });

    if (updatedBalance) {
      broadcastBalanceUpdate(userId, updatedBalance);
    }

    res.status(200).json({
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
}

export async function getUserOrders(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = req.user.userId;

    const openOrders = orderManager.getUserOpenOrders(userId);

    const closedOrders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        symbol: true,
      },
    });

    const balance = await balanceManager.getUserBalance(userId);

    // Format orders for display
    const formattedOpenOrders = openOrders.map((order) => ({
      ...order,
      price: order.price / 100,
      stopLoss: order.stopLoss ? order.stopLoss / 100 : null,
      takeProfit: order.takeProfit ? order.takeProfit / 100 : null,
    }));

    const formattedClosedOrders = closedOrders.map((order) => ({
      ...order,
      symbolName: order.symbol.name,
      price: order.price / 100,
      exitPrice: order.exitPrice ? order.exitPrice / 100 : null,
      pnl: order.pnl ? order.pnl / 100 : null,
      stopLoss: order.stopLoss ? order.stopLoss / 100 : null,
      takeProfit: order.takeProfit ? order.takeProfit / 100 : null,
    }));

    res.status(200).json({
      openOrders: formattedOpenOrders,
      closedOrders: formattedClosedOrders,
      balance: balance ? balance.total : null,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

/**
 * Get user portfolio information
 */
export async function getUserPortfolio(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = req.user.userId;


    const balance = await balanceManager.getUserBalance(userId);

    if (!balance) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Calculate positions from orders
    const positions = await calculateUserPositions(userId);

    // Format balance for display
    const formattedBalance = {
      total: balance.total / 100,
      reserved: balance.reserved / 100,
      available: balance.available / 100,
    };

    res.status(200).json({
      balance: formattedBalance,
      positions,
    });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
}

/**
 * Helper function to calculate user positions from orders
 */
async function calculateUserPositions(userId: string) {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: OrderStatus.CLOSED,
    },
    include: {
      symbol: true,
    },
  });

  const positionMap = new Map<
    string,
    {
      symbol: string;
      amount: number;
      avgPrice: number;
      totalCost: number;
      isShort: boolean;
      unrealizedPnl: number;
    }
  >();

  for (const order of orders) {
    const symbolName = order.symbol.name;

    if (!positionMap.has(symbolName)) {
      positionMap.set(symbolName, {
        symbol: symbolName,
        amount: 0,
        avgPrice: 0,
        totalCost: 0,
        isShort: false,
        unrealizedPnl: 0,
      });
    }

    const position = positionMap.get(symbolName)!;

    if (order.type === OrderType.BUY && !order.isShort) {
      // Long buy
      position.amount += order.quantity;
      position.totalCost += order.price * order.quantity;
    } else if (order.type === OrderType.SELL && !order.isShort) {
      // Long sell
      position.amount -= order.quantity;
      position.totalCost -= order.price * order.quantity;
    } else if (order.type === OrderType.SELL && order.isShort) {
      // Short sell
      position.amount -= order.quantity;
      position.totalCost -= order.price * order.quantity;
      position.isShort = true;
    } else if (order.type === OrderType.BUY && order.isShort) {
      // Short buy (cover)
      position.amount += order.quantity;
      position.totalCost += order.price * order.quantity;
    }

    // Calculate average price
    if (position.amount !== 0) {
      position.avgPrice = Math.abs(position.totalCost / position.amount);
    }
  }

  // Calculate unrealized PnL based on current prices
  for (const [symbolName, position] of positionMap.entries()) {
    if (position.amount === 0) continue;

    const symbol = await prisma.symbol.findFirst({
      where: { name: symbolName },
    });

    if (symbol && symbol.currentPrice) {
      const currentPrice = symbol.currentPrice;

      if (position.isShort) {
        // Short position: profit when price goes down
        position.unrealizedPnl =
          (position.avgPrice - currentPrice) * Math.abs(position.amount);
      } else {
        // Long position: profit when price goes up
        position.unrealizedPnl =
          (currentPrice - position.avgPrice) * position.amount;
      }
    }
  }

  // Filter out zero positions and format for display
  return Array.from(positionMap.values())
    .filter((position) => position.amount !== 0)
    .map((position) => ({
      symbol: position.symbol,
      amount: Math.abs(position.amount),
      avgPrice: position.avgPrice / 100,
      isShort: position.isShort,
      unrealizedPnl: position.unrealizedPnl / 100,
    }));
}
