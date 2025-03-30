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

// Response structure for paginated candle data
export interface PaginatedCandleResponse {
  candles: CandleData[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
}

// Add proper types for the legacy endpoints
interface LegacyCandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
 * Fetch historical candle data for a symbol with support for pagination
 */
export async function fetchHistoricalData(
  symbol: string,
  timeframe: Timeframe = DEFAULT_TIMEFRAME as Timeframe,
  limit: number = 1000,
  startTime?: Date | number,
  endTime?: Date | number,
  page: number = 0,
  loadAllAvailable: boolean = false
): Promise<CandleData[]> {
  try {
    console.log(
      `MarketData: Fetching historical data for ${symbol} with timeframe ${timeframe} (page ${page}, limit ${limit})`
    );

    // Convert startTime and endTime to proper format if provided
    const formattedStartTime = startTime
      ? typeof startTime === "number"
        ? Math.floor(startTime / 1000).toString() // Convert to string for API
        : Math.floor(startTime.getTime() / 1000).toString()
      : undefined;

    const formattedEndTime = endTime
      ? typeof endTime === "number"
        ? Math.floor(endTime / 1000).toString() // Convert to string for API
        : Math.floor(endTime.getTime() / 1000).toString()
      : undefined;

    try {
      // Update the params object to only include defined values
      const params: Record<string, string> = {
        symbol: symbol.toLowerCase(),
        timeframe,
        limit: limit.toString(),
        page: page.toString(),
      };

      // Only add startTime and endTime if they are defined
      if (formattedStartTime) {
        params.startTime = formattedStartTime;
      }
      if (formattedEndTime) {
        params.endTime = formattedEndTime;
      }

      // Use the params object in the API call
      const response = await apiClient.get<PaginatedCandleResponse>(
        "/candles",
        { params }
      );

      let candles = response.candles || [];

      console.log(
        `MarketData: Received ${candles.length} candles for ${symbol} (page ${page})`
      );

      // If loadAllAvailable is true and there are more pages, fetch them all
      if (loadAllAvailable && response.pagination?.hasMore) {
        console.log(`MarketData: Loading all available candles for ${symbol}`);

        const totalPages = Math.ceil(response.pagination.totalCount / limit);
        const remainingPages = [];

        // Load all remaining pages in parallel (up to a reasonable maximum)
        const maxPagesToLoad = Math.min(totalPages - page - 1, 10); // Limit to 10 more pages max

        for (let i = page + 1; i <= page + maxPagesToLoad; i++) {
          remainingPages.push(
            fetchHistoricalData(symbol, timeframe, limit, startTime, endTime, i)
          );
        }

        const additionalData = await Promise.all(remainingPages);
        additionalData.forEach((pageCandleData) => {
          candles = [...candles, ...pageCandleData];
        });

        console.log(
          `MarketData: Loaded total ${candles.length} candles across multiple pages`
        );
      }

      // Transform the data to ensure proper time formatting
      const transformedData = candles.map((item) => ({
        // Handle both timestamp formats (string ISO date or number)
        time:
          typeof item.time === "string"
            ? Math.floor(new Date(item.time).getTime() / 1000)
            : typeof item.time === "number" && item.time > 10000000000
            ? Math.floor(item.time / 1000) // Convert ms to seconds if needed
            : (item.time as number),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      // Sort by time to ensure proper ordering
      transformedData.sort((a, b) => a.time - b.time);

      return transformedData;
    } catch (apiError) {
      console.warn(
        `MarketData: New candles API error for ${symbol}:`,
        apiError
      );

      // Try legacy market/candles endpoint
      try {
        // Update the legacy endpoint calls similarly
        const legacyParams: Record<string, string> = {
          symbol: symbol.toLowerCase(),
          timeframe,
          limit: limit.toString(),
        };

        if (formattedStartTime) {
          legacyParams.startTime = formattedStartTime;
        }
        if (formattedEndTime) {
          legacyParams.endTime = formattedEndTime;
        }

        const data = await apiClient.get<LegacyCandleData[]>(
          "/market/candles",
          {
            params: legacyParams,
          }
        );

        console.log(
          `MarketData: Received ${data.length} candles from legacy endpoint for ${symbol}`
        );

        // Transform data to match CandleData interface
        const transformedData = data.map((item) => ({
          time: item.timestamp / 1000, // Convert to seconds for TradingView
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        }));

        // Sort by time to ensure proper ordering
        transformedData.sort((a, b) => a.time - b.time);

        return transformedData;
      } catch (legacyError) {
        console.warn(
          `MarketData: Legacy endpoint also failed for ${symbol}:`,
          legacyError
        );

        // Try alternative endpoint as last resort
        try {
          const data = await apiClient.get<LegacyCandleData[]>(
            "/market/history",
            {
              params: {
                symbol: symbol.toLowerCase(),
                timeframe,
                limit: limit.toString(),
              },
            }
          );

          console.log(
            `MarketData: Received ${data.length} candles from alternative endpoint for ${symbol}`
          );

          // Transform data to match CandleData interface
          const transformedData = data.map((item) => ({
            time: item.timestamp / 1000, // Convert to seconds for TradingView
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
          }));

          // Sort by time to ensure proper ordering
          transformedData.sort((a, b) => a.time - b.time);

          return transformedData;
        } catch (altError) {
          console.warn(
            `MarketData: All API endpoints failed for ${symbol}:`,
            altError
          );

          // If all API endpoints fail, fall back to mock data
          console.log(`MarketData: Falling back to mock data for ${symbol}`);
          const mockData = generateMockHistoricalData(
            symbol.toLowerCase().includes("btc") ? 45000 : 2000,
            limit
          );
          return mockData;
        }
      }
    }
  } catch (error) {
    console.error(
      `MarketData: Error in fetchHistoricalData for ${symbol}:`,
      error
    );

    // Final fallback to mock data
    console.log(`MarketData: Final fallback to mock data for ${symbol}`);
    return generateMockHistoricalData(
      symbol.toLowerCase().includes("btc") ? 45000 : 2000,
      limit
    );
  }
}

/**
 * Get total count of available candles for a symbol and timeframe
 */
export async function getCandleCount(
  symbol: string,
  timeframe: Timeframe = DEFAULT_TIMEFRAME as Timeframe,
  startTime?: Date | number,
  endTime?: Date | number
): Promise<number> {
  try {
    const formattedStartTime = startTime
      ? typeof startTime === "number"
        ? Math.floor(startTime / 1000).toString() // Convert to string for API
        : Math.floor(startTime.getTime() / 1000).toString()
      : undefined;

    const formattedEndTime = endTime
      ? typeof endTime === "number"
        ? Math.floor(endTime / 1000).toString() // Convert to string for API
        : Math.floor(endTime.getTime() / 1000).toString()
      : undefined;

    // Update the getCandleCount function similarly
    const countParams: Record<string, string> = {
      symbol: symbol.toLowerCase(),
      timeframe,
    };

    if (formattedStartTime) {
      countParams.startTime = formattedStartTime;
    }
    if (formattedEndTime) {
      countParams.endTime = formattedEndTime;
    }

    const response = await apiClient.get<{ count: number }>("/candles/count", {
      params: countParams,
    });

    return response.count;
  } catch (error) {
    console.error(`Error getting candle count for ${symbol}:`, error);
    return 0;
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
    const volume = Math.random() * 100 + 10;

    // Add candle to the data array (1-minute intervals)
    data.push({
      time: now - (count - i) * 60, // Using seconds as timestamp (for lightweight-charts)
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
