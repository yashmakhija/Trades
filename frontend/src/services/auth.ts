import { apiClient } from "@/lib/api/api-client";

// Updated User interface to match API response
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  usdcBalance: number;
}

// Demo account interface
export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: string;
}

// User profile data with trading metrics
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
  metrics: {
    totalTrades: number;
    openPositions: number;
    pnl: number;
    winRate?: number;
  };
  recentTrades?: Array<{
    id: string;
    symbol: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    status: string;
    pnl?: number;
    createdAt: string;
  }>;
}

// Auth response interfaces
export interface AuthResponse {
  user: ApiUser;
  token: string;
  message?: string;
}

// Add these interfaces based on the actual backend API responses
interface UserStatsResponse {
  totalTrades: number;
  profitableTrades: number;
  lossMakingTrades: number;
  totalPnL: number;
  winRate: number;
  averagePnL: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldingTimeHours: number;
}

interface TradeHistoryItem {
  id: string;
  symbolId: string;
  symbolName: string;
  side: string;
  price: number;
  quantity: number;
  exitPrice: number;
  pnl: number;
  timestamp: string;
}

interface TradeHistoryResponse {
  trades: TradeHistoryItem[];
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}

/**
 * Register a new demo account
 */
export async function registerDemoAccount(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/register", {
      name,
      email,
      password,
    });

    return data;
  } catch (error) {
    console.error("Error registering demo account:", error);
    throw error;
  }
}

/**
 * Login to a demo account
 */
export async function loginDemoAccount(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    return data;
  } catch (error) {
    console.error("Error logging in to demo account:", error);
    throw error;
  }
}

/**
 * Create a quick demo account without registration
 */
export async function createQuickDemoAccount(): Promise<AuthResponse> {
  try {
    const data = await apiClient.post<AuthResponse>("/auth/demo/quick");

    return data;
  } catch (error) {
    console.error("Error creating quick demo account:", error);
    throw error;
  }
}

/**
 * Get demo account details
 */
export async function getDemoAccountDetails(): Promise<DemoAccount> {
  try {
    return await apiClient.get<DemoAccount>("/auth/demo/account");
  } catch (error) {
    console.error("Error fetching demo account details:", error);
    throw error;
  }
}

/**
 * Get user profile with trading metrics and history
 */
export async function getUserProfile(): Promise<UserProfile> {
  try {
    // First get the basic profile
    const userBasicProfile = await apiClient.get<{ user: ApiUser }>(
      "/auth/profile"
    );

    // Get trading metrics
    const userStats = await apiClient.get<UserStatsResponse>(
      "/analytics/user-stats"
    );

    // Get recent trading history
    const tradeHistory = await apiClient.get<TradeHistoryResponse>(
      "/analytics/trade-history",
      {
        params: { limit: "5", page: "1" }, // Get 5 most recent trades
      }
    );

    // Combine data into UserProfile object
    const profile: UserProfile = {
      id: userBasicProfile.user.id,
      username: userBasicProfile.user.name,
      email: userBasicProfile.user.email,
      balance: userBasicProfile.user.usdcBalance,
      createdAt: new Date().toISOString(), // Use current time as fallback since backend doesn't provide createdAt
      metrics: {
        totalTrades: userStats.totalTrades || 0,
        openPositions: 0, // This information might need to be calculated or fetched from another endpoint
        pnl: userStats.totalPnL || 0,
        winRate: userStats.winRate || 0,
      },
      recentTrades:
        tradeHistory.trades?.map((trade) => ({
          id: trade.id,
          symbol: trade.symbolName,
          side: trade.side.toLowerCase() as "buy" | "sell",
          amount: trade.quantity,
          price: trade.price,
          status: "completed",
          pnl: trade.pnl,
          createdAt: trade.timestamp,
        })) || [],
    };

    return profile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}
