import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { tradeAnalytics } from "../services/tradeAnalyticsService";

const router = Router();

/**
 * @route GET /api/analytics/user-stats
 * @desc Get user trading statistics
 * @access Private
 */
router.get("/user-stats", authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await tradeAnalytics.getUserStats(userId, startDate, endDate);

    // Add win rate percentage for frontend
    const result = {
      ...stats,
      totalWins: stats.profitableTrades,
      pnlPercentage:
        stats.totalTrades > 0 ? stats.totalPnL / (stats.totalPnL * 10) : 0,
      averageTrade: stats.averagePnL,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Failed to fetch user statistics" });
  }
});

/**
 * @route GET /api/analytics/symbol-stats
 * @desc Get trading statistics per symbol
 * @access Private
 */
router.get("/symbol-stats", authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const stats = await tradeAnalytics.getSymbolStats(
      userId,
      startDate,
      endDate
    );

    // Transform data for frontend
    const result = stats.map((stat) => ({
      symbolId: stat.symbol,
      symbolName: stat.symbol,
      totalTrades: stat.totalTrades,
      wins: stat.profitableTrades,
      losses: stat.lossMakingTrades,
      winRate: stat.winRate / 100, // Convert to decimal for frontend
      pnl: stat.totalPnL,
      averageTrade: stat.averagePnL,
      volume: stat.volume,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching symbol stats:", error);
    res.status(500).json({ message: "Failed to fetch symbol statistics" });
  }
});

/**
 * @route GET /api/analytics/daily-pnl
 * @desc Get daily PnL for a date range
 * @access Private
 */
router.get("/daily-pnl", authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Default to last 30 days if no dates provided
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyPnL = await tradeAnalytics.getDailyPnL(
      userId,
      startDate,
      endDate
    );
    res.json(dailyPnL);
  } catch (error) {
    console.error("Error fetching daily PnL:", error);
    res.status(500).json({ message: "Failed to fetch daily PnL data" });
  }
});

/**
 * @route GET /api/analytics/trade-history
 * @desc Get trade history with pagination
 * @access Private
 */
router.get("/trade-history", authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const symbolId = req.query.symbolId as string;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const result = await tradeAnalytics.getTradeHistory(
      userId,
      page,
      limit,
      symbolId,
      startDate,
      endDate
    );

    // Transform trades for frontend
    const transformedTrades = result.trades.map((trade) => ({
      id: trade.id,
      symbolId: trade.symbolId,
      symbolName: trade.symbol.name,
      side: trade.isShort ? "SELL" : "BUY",
      price: trade.price,
      quantity: trade.quantity,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl,
      timestamp: trade.closedAt || trade.createdAt,
    }));

    res.json({
      trades: transformedTrades,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching trade history:", error);
    res.status(500).json({ message: "Failed to fetch trade history" });
  }
});

export default router;
