import { CandleData } from "./websocket";
import { DEFAULT_TIMEFRAME } from "@/config/index";
import { apiClient } from "@/lib/api/api-client";

// Timeframe options
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

// Symbol data interface
export interface SymbolData {
  id: string;
  name: string;
  description: string;
  currentPrice: number | null;
}

/**
 * Fetch all available trading symbols
 */
export async function fetchSymbols(): Promise<SymbolData[]> {
  try {
    return await apiClient.get<SymbolData[]>("/symbols");
  } catch (error) {
    console.error("Error fetching symbols:", error);
    return [];
  }
}

/**
 * Fetch detailed information for a specific symbol
 */
export async function fetchSymbolDetails(
  symbolName: string
): Promise<SymbolData | null> {
  try {
    return await apiClient.get<SymbolData>(
      `/symbols/${symbolName.toLowerCase()}`
    );
  } catch (error) {
    console.error(`Error fetching symbol details for ${symbolName}:`, error);
    return null;
  }
}

/**
 * Fetch latest prices for all symbols
 */
export async function fetchLatestPrices(): Promise<Record<string, number>> {
  try {
    return await apiClient.get<Record<string, number>>("/symbols/prices");
  } catch (error) {
    console.error("Error fetching latest prices:", error);
    return {};
  }
}

/**
 * Fetch historical candle data for a symbol
 */
export async function fetchHistoricalData(
  symbol: string,
  timeframe: Timeframe = DEFAULT_TIMEFRAME as Timeframe,
  limit: number = 100
): Promise<CandleData[]> {
  try {
    const data = await apiClient.get<any[]>("/market/history", {
      params: {
        symbol: symbol.toLowerCase(),
        timeframe,
        limit: limit.toString(),
      },
    });

    // Transform data to match CandleData interface
    return data.map(
      (item: {
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }) => ({
        time: item.timestamp / 1000, // Convert to seconds for TradingView
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      })
    );
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

/**
 * Generate mock historical data for development
 * This is used when the backend is not available
 */
export function generateMockHistoricalData(
  basePrice: number = 45000,
  count: number = 100
): CandleData[] {
  const now = Math.floor(Date.now() / 1000);
  const data: CandleData[] = [];

  let lastClose = basePrice;

  for (let i = 0; i < count; i++) {
    // Generate random price movement
    const changePercent = (Math.random() * 2 - 1) * 0.02; // -1% to +1%
    const close = lastClose * (1 + changePercent);

    // Generate random high/low within reasonable range
    const highLowRange = close * 0.01; // 1% range
    const high = close + Math.random() * highLowRange;
    const low = close - Math.random() * highLowRange;

    // Ensure open is between high and low
    const open = low + Math.random() * (high - low);

    // Generate random volume
    const volume = Math.random() * 100 + 50;

    // Add candle
    data.push({
      time: now - (count - i) * 3600, // 1 hour intervals
      open,
      high,
      low,
      close,
      volume,
    });

    lastClose = close;
  }

  return data;
}
