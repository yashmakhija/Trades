import { PrismaClient, Order, OrderStatus, OrderType } from "@prisma/client";
import { EventEmitter } from "events";

const prisma = new PrismaClient();

interface TradeStats {
  totalTrades: number;
  profitableTrades: number;
  lossMakingTrades: number;
  totalPnL: number;
  winRate: number;
  averagePnL: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldingTime: number; // in minutes
}

interface SymbolStats extends TradeStats {
  symbol: string;
  volume: number;
}

/**
 * Service for analyzing trading history and performance
 */
class TradeAnalyticsService extends EventEmitter {
  /**
   * Get trade history for a user with pagination
   */
  async getTradeHistory(
    userId: string,
    page: number = 1,
    limit: number = 50,
    symbolId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      const where: any = {
        userId,
        status: OrderStatus.CLOSED,
      };

      if (symbolId) {
        where.symbolId = symbolId;
      }

      if (startDate || endDate) {
        where.closedAt = {};
        if (startDate) where.closedAt.gte = startDate;
        if (endDate) where.closedAt.lte = endDate;
      }

      const [trades, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            symbol: true,
          },
          orderBy: {
            closedAt: "desc",
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      return {
        trades,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      };
    } catch (error) {
      console.error("Error fetching trade history:", error);
      throw error;
    }
  }

  /**
   * Get trading statistics for a user
   */
  async getUserStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TradeStats> {
    try {
      const where: any = {
        userId,
        status: OrderStatus.CLOSED,
        pnl: { not: null },
      };

      if (startDate || endDate) {
        where.closedAt = {};
        if (startDate) where.closedAt.gte = startDate;
        if (endDate) where.closedAt.lte = endDate;
      }

      const trades = await prisma.order.findMany({
        where,
        select: {
          pnl: true,
          price: true,
          exitPrice: true,
          createdAt: true,
          closedAt: true,
        },
      });

      if (trades.length === 0) {
        return {
          totalTrades: 0,
          profitableTrades: 0,
          lossMakingTrades: 0,
          totalPnL: 0,
          winRate: 0,
          averagePnL: 0,
          bestTrade: 0,
          worstTrade: 0,
          averageHoldingTime: 0,
        };
      }

      const profitableTrades = trades.filter((t) => (t.pnl || 0) > 0).length;
      const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      const holdingTimes = trades.map((t) => {
        const created = new Date(t.createdAt);
        const closed = new Date(t.closedAt!);
        return (closed.getTime() - created.getTime()) / (1000 * 60); // Convert to minutes
      });

      return {
        totalTrades: trades.length,
        profitableTrades,
        lossMakingTrades: trades.length - profitableTrades,
        totalPnL,
        winRate: (profitableTrades / trades.length) * 100,
        averagePnL: totalPnL / trades.length,
        bestTrade: Math.max(...trades.map((t) => t.pnl || 0)),
        worstTrade: Math.min(...trades.map((t) => t.pnl || 0)),
        averageHoldingTime:
          holdingTimes.reduce((sum, time) => sum + time, 0) / trades.length,
      };
    } catch (error) {
      console.error("Error calculating user stats:", error);
      throw error;
    }
  }

  /**
   * Get trading statistics per symbol for a user
   */
  async getSymbolStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SymbolStats[]> {
    try {
      const where: any = {
        userId,
        status: OrderStatus.CLOSED,
        pnl: { not: null },
      };

      if (startDate || endDate) {
        where.closedAt = {};
        if (startDate) where.closedAt.gte = startDate;
        if (endDate) where.closedAt.lte = endDate;
      }

      const trades = await prisma.order.findMany({
        where,
        include: {
          symbol: true,
        },
      });

      const symbolMap = new Map<string, Order[]>();
      trades.forEach((trade) => {
        if (!symbolMap.has(trade.symbol.name)) {
          symbolMap.set(trade.symbol.name, []);
        }
        symbolMap.get(trade.symbol.name)!.push(trade);
      });

      const stats: SymbolStats[] = [];

      for (const [symbol, symbolTrades] of symbolMap) {
        const profitableTrades = symbolTrades.filter(
          (t) => (t.pnl || 0) > 0
        ).length;
        const totalPnL = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const volume = symbolTrades.reduce((sum, t) => sum + t.quantity, 0);

        const holdingTimes = symbolTrades.map((t) => {
          const created = new Date(t.createdAt);
          const closed = new Date(t.closedAt!);
          return (closed.getTime() - created.getTime()) / (1000 * 60);
        });

        stats.push({
          symbol,
          totalTrades: symbolTrades.length,
          profitableTrades,
          lossMakingTrades: symbolTrades.length - profitableTrades,
          totalPnL,
          winRate: (profitableTrades / symbolTrades.length) * 100,
          averagePnL: totalPnL / symbolTrades.length,
          bestTrade: Math.max(...symbolTrades.map((t) => t.pnl || 0)),
          worstTrade: Math.min(...symbolTrades.map((t) => t.pnl || 0)),
          averageHoldingTime:
            holdingTimes.reduce((sum, time) => sum + time, 0) /
            symbolTrades.length,
          volume,
        });
      }

      return stats.sort((a, b) => b.totalPnL - a.totalPnL);
    } catch (error) {
      console.error("Error calculating symbol stats:", error);
      throw error;
    }
  }

  /**
   * Get daily PnL for a date range
   */
  async getDailyPnL(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; pnl: number }[]> {
    try {
      const trades = await prisma.order.findMany({
        where: {
          userId,
          status: OrderStatus.CLOSED,
          pnl: { not: null },
          closedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          closedAt: true,
          pnl: true,
        },
      });

      const dailyPnL = new Map<string, number>();

      trades.forEach((trade) => {
        const date = trade.closedAt!.toISOString().split("T")[0];
        const currentPnL = dailyPnL.get(date) || 0;
        dailyPnL.set(date, currentPnL + (trade.pnl || 0));
      });

      return Array.from(dailyPnL.entries())
        .map(([date, pnl]) => ({ date, pnl }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error("Error calculating daily PnL:", error);
      throw error;
    }
  }
}

// Singleton instance
export const tradeAnalytics = new TradeAnalyticsService();
export default tradeAnalytics;
