import { Timeframe } from "@prisma/client";

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeMinutes {
  [key: string]: number;
}

export const TIMEFRAME_MINUTES: TimeframeMinutes = {
  [Timeframe.ONE_MINUTE]: 1,
  [Timeframe.FIVE_MINUTES]: 5,
  [Timeframe.TEN_MINUTES]: 10,
  [Timeframe.FIFTEEN_MINUTES]: 15,
  [Timeframe.THIRTY_MINUTES]: 30,
  [Timeframe.ONE_HOUR]: 60,
  [Timeframe.FOUR_HOURS]: 240,
  [Timeframe.ONE_DAY]: 1440,
};

/**
 * Map string timeframe to Timeframe enum
 */
export function mapTimeframe(timeframe: string): Timeframe {
  switch (timeframe.toLowerCase()) {
    case "1m":
      return Timeframe.ONE_MINUTE;
    case "5m":
      return Timeframe.FIVE_MINUTES;
    case "10m":
      return Timeframe.TEN_MINUTES;
    case "15m":
      return Timeframe.FIFTEEN_MINUTES;
    case "30m":
      return Timeframe.THIRTY_MINUTES;
    case "1h":
      return Timeframe.ONE_HOUR;
    case "4h":
      return Timeframe.FOUR_HOURS;
    case "1d":
      return Timeframe.ONE_DAY;
    default:
      return Timeframe.ONE_MINUTE;
  }
}

/**
 * Get default time range for a timeframe
 */
export function getDefaultTimeRange(timeframe: string): number {
  const ranges: Record<string, number> = {
    "1m": 24 * 60 * 60 * 1000, // 1 day for 1m
    "5m": 5 * 24 * 60 * 60 * 1000, // 5 days for 5m
    "10m": 7 * 24 * 60 * 60 * 1000, // 7 days for 10m
    "15m": 7 * 24 * 60 * 60 * 1000, // 7 days for 15m
    "30m": 14 * 24 * 60 * 60 * 1000, // 14 days for 30m
    "1h": 30 * 24 * 60 * 60 * 1000, // 30 days for 1h
    "4h": 60 * 24 * 60 * 60 * 1000, // 60 days for 4h
    "1d": 180 * 24 * 60 * 60 * 1000, // 180 days for 1d
  };

  return ranges[timeframe] || 24 * 60 * 60 * 1000; // Default to 1 day
}

/**
 * Format candle data for API response
 */
export function formatCandleData(candle: any): CandleData {
  return {
    time: Math.floor(candle.time.getTime() / 1000),
    open: candle.open / 100, // Convert to dollars for display
    high: candle.high / 100,
    low: candle.low / 100,
    close: candle.close / 100,
    volume: candle.volume / 100,
  };
}

/**
 * Get timeframe ratio between two timeframes
 */
export function getTimeframeRatio(
  smaller: Timeframe,
  larger: Timeframe
): number {
  return TIMEFRAME_MINUTES[larger] / TIMEFRAME_MINUTES[smaller];
}
