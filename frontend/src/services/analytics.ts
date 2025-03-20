import { apiClient } from "@/lib/api/api-client";

// Types for analytics data
export interface TradeStats {
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

export interface SymbolStats extends TradeStats {
  symbol: string;
  volume: number;
}

export interface Trade {
  id: string;
  symbolId: string;
  symbolName: string;
  side?: "BUY" | "SELL";
  type?: "BUY" | "SELL";
  price: number;
  quantity: number;
  exitPrice: number | null;
  pnl: number | null;
  status?: "OPEN" | "FILLED" | "CLOSED" | "CANCELLED" | "REJECTED";
  isShort?: boolean;
  createdAt?: string;
  closedAt?: string | null;
  timestamp?: string;
}

export interface TradeHistoryResponse {
  trades: Trade[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    perPage: number;
  };
}

export interface DailyPnL {
  date: string;
  pnl: number;
}

/**
 * Fetch user's trading statistics
 */
export async function fetchUserStats(
  startDate?: Date,
  endDate?: Date
): Promise<TradeStats> {
  try {
    const params: Record<string, string> = {};

    if (startDate) {
      params.startDate = startDate.toISOString();
    }

    if (endDate) {
      params.endDate = endDate.toISOString();
    }

    return await apiClient.get<TradeStats>("/analytics/user-stats", { params });
  } catch (error) {
    console.error("Error fetching user stats:", error);
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
}

/**
 * Fetch trading statistics per symbol
 */
export async function fetchSymbolStats(
  startDate?: Date,
  endDate?: Date
): Promise<SymbolStats[]> {
  try {
    const params: Record<string, string> = {};

    if (startDate) {
      params.startDate = startDate.toISOString();
    }

    if (endDate) {
      params.endDate = endDate.toISOString();
    }

    return await apiClient.get<SymbolStats[]>("/analytics/symbol-stats", {
      params,
    });
  } catch (error) {
    console.error("Error fetching symbol stats:", error);
    return [];
  }
}

/**
 * Fetch daily profit/loss data
 */
export async function fetchDailyPnL(
  startDate?: Date,
  endDate?: Date
): Promise<DailyPnL[]> {
  try {
    const params: Record<string, string> = {};

    if (startDate) {
      params.startDate = startDate.toISOString();
    }

    if (endDate) {
      params.endDate = endDate.toISOString();
    }

    return await apiClient.get<DailyPnL[]>("/analytics/daily-pnl", { params });
  } catch (error) {
    console.error("Error fetching daily PnL:", error);
    return [];
  }
}

/**
 * Fetch trade history with pagination
 */
export async function fetchTradeHistory(
  page: number = 1,
  limit: number = 10,
  symbolId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<TradeHistoryResponse> {
  try {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
    };

    if (symbolId) {
      params.symbolId = symbolId;
    }

    if (startDate) {
      params.startDate = startDate.toISOString();
    }

    if (endDate) {
      params.endDate = endDate.toISOString();
    }

    return await apiClient.get<TradeHistoryResponse>(
      "/analytics/trade-history",
      { params }
    );
  } catch (error) {
    console.error("Error fetching trade history:", error);
    return {
      trades: [],
      pagination: {
        total: 0,
        pages: 0,
        currentPage: page,
        perPage: limit,
      },
    };
  }
}
