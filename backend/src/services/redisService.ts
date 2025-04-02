import Redis from "ioredis";
import { Timeframe, OHLCV } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../lib/prisma";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CacheStrategy {
  cacheTTL: number;
  maxCachedCandles: number;
  historicalTTL: number; // TTL for historical data
}

class RedisService {
  private redis: Redis;
  private readonly CACHE_STRATEGIES: Record<Timeframe, CacheStrategy> = {
    [Timeframe.ONE_MINUTE]: {
      cacheTTL: 60,
      maxCachedCandles: 1000,
      historicalTTL: 86400 * 30, // 30 days
    },
    [Timeframe.FIVE_MINUTES]: {
      cacheTTL: 300,
      maxCachedCandles: 800,
      historicalTTL: 86400 * 90, // 90 days
    },
    [Timeframe.TEN_MINUTES]: {
      cacheTTL: 600,
      maxCachedCandles: 700,
      historicalTTL: 86400 * 180, // 180 days
    },
    [Timeframe.FIFTEEN_MINUTES]: {
      cacheTTL: 900,
      maxCachedCandles: 600,
      historicalTTL: 86400 * 365, // 1 year
    },
    [Timeframe.THIRTY_MINUTES]: {
      cacheTTL: 1800,
      maxCachedCandles: 500,
      historicalTTL: 86400 * 365 * 2, // 2 years
    },
    [Timeframe.ONE_HOUR]: {
      cacheTTL: 3600,
      maxCachedCandles: 400,
      historicalTTL: 86400 * 365 * 5, // 5 years
    },
    [Timeframe.FOUR_HOURS]: {
      cacheTTL: 14400,
      maxCachedCandles: 300,
      historicalTTL: 86400 * 365 * 10, // 10 years
    },
    [Timeframe.ONE_DAY]: {
      cacheTTL: 86400,
      maxCachedCandles: 200,
      historicalTTL: 86400 * 365 * 20, // 20 years
    },
  };

  private readonly CANDLE_PREFIX = "candle:";
  private readonly AGGREGATE_PREFIX = "aggregate:";
  private readonly LATEST_PREFIX = "latest:";
  private readonly HISTORICAL_PREFIX = "historical:";

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });
  }

  async getCachedCandles(
    symbol: string,
    timeframe: Timeframe,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[] | null> {
    try {
      const strategy = this.CACHE_STRATEGIES[timeframe];
      const key = this.getCandleKey(symbol, timeframe);
      const historicalKey = this.getHistoricalKey(symbol, timeframe);

      // Try to get from cache first
      const cached = await this.redis.get(key);
      if (cached) {
        const candles: CandleData[] = JSON.parse(cached);
        return this.filterCandlesByTimeRange(candles, startTime, endTime);
      }

      // If not in cache, try to get from historical data
      const historical = await this.redis.get(historicalKey);
      if (historical) {
        const candles: CandleData[] = JSON.parse(historical);
        return this.filterCandlesByTimeRange(candles, startTime, endTime);
      }

      // If not in Redis, fetch from database
      const dbCandles = await this.fetchCandlesFromDB(
        symbol,
        timeframe,
        startTime,
        endTime
      );
      if (dbCandles) {
        await this.cacheCandles(symbol, timeframe, dbCandles);
      }

      return dbCandles;
    } catch (error) {
      console.error("Error getting cached candles:", error);
      return null;
    }
  }

  private async fetchCandlesFromDB(
    symbol: string,
    timeframe: Timeframe,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[] | null> {
    try {
      const where: any = {
        symbol: { name: symbol.toLowerCase() },
        timeframe,
      };

      if (startTime) {
        where.time = { gte: new Date(startTime) };
      }
      if (endTime) {
        where.time = { ...where.time, lte: new Date(endTime) };
      }

      const candles = await prisma.oHLCV.findMany({
        where,
        orderBy: { time: "asc" },
        select: {
          time: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      return candles.map((candle) => ({
        time: candle.time.getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));
    } catch (error) {
      console.error("Error fetching candles from DB:", error);
      return null;
    }
  }

  async cacheCandles(
    symbol: string,
    timeframe: Timeframe,
    candles: CandleData[]
  ): Promise<void> {
    try {
      const strategy = this.CACHE_STRATEGIES[timeframe];
      const key = this.getCandleKey(symbol, timeframe);
      const historicalKey = this.getHistoricalKey(symbol, timeframe);

      // Round timestamps based on timeframe
      const roundedCandles = candles.map((candle) => {
        const time = new Date(candle.time);
        const minutes = time.getMinutes();
        const hours = time.getHours();
        const days = time.getDate();

        switch (timeframe) {
          case Timeframe.ONE_MINUTE:
            time.setSeconds(0, 0);
            break;
          case Timeframe.FIVE_MINUTES:
            time.setMinutes(Math.floor(minutes / 5) * 5);
            time.setSeconds(0, 0);
            break;
          case Timeframe.TEN_MINUTES:
            time.setMinutes(Math.floor(minutes / 10) * 10);
            time.setSeconds(0, 0);
            break;
          case Timeframe.FIFTEEN_MINUTES:
            time.setMinutes(Math.floor(minutes / 15) * 15);
            time.setSeconds(0, 0);
            break;
          case Timeframe.THIRTY_MINUTES:
            time.setMinutes(Math.floor(minutes / 30) * 30);
            time.setSeconds(0, 0);
            break;
          case Timeframe.ONE_HOUR:
            time.setMinutes(0);
            time.setSeconds(0, 0);
            break;
          case Timeframe.FOUR_HOURS:
            time.setHours(Math.floor(hours / 4) * 4);
            time.setMinutes(0);
            time.setSeconds(0, 0);
            break;
          case Timeframe.ONE_DAY:
            time.setHours(0);
            time.setMinutes(0);
            time.setSeconds(0, 0);
            break;
        }

        return {
          ...candle,
          time: time.getTime(),
        };
      });

      // Remove duplicates based on rounded timestamps
      const uniqueCandles = roundedCandles.reduce((acc, candle) => {
        const existingIndex = acc.findIndex((c) => c.time === candle.time);
        if (existingIndex === -1) {
          acc.push(candle);
        } else {
          // Update existing candle with aggregated values
          acc[existingIndex] = {
            ...acc[existingIndex],
            high: Math.max(acc[existingIndex].high, candle.high),
            low: Math.min(acc[existingIndex].low, candle.low),
            close: candle.close,
            volume: acc[existingIndex].volume + candle.volume,
          };
        }
        return acc;
      }, [] as CandleData[]);

      // Sort by time
      uniqueCandles.sort((a, b) => a.time - b.time);

      // Split candles into recent and historical
      const now = Date.now();
      const recentCandles = uniqueCandles.filter(
        (c) => c.time > now - strategy.cacheTTL * 1000
      );
      const historicalCandles = uniqueCandles.filter(
        (c) => c.time <= now - strategy.cacheTTL * 1000
      );

      // Cache recent candles with short TTL
      if (recentCandles.length > 0) {
        await this.redis.setex(
          key,
          strategy.cacheTTL,
          JSON.stringify(recentCandles.slice(-strategy.maxCachedCandles))
        );
      }

      // Cache historical candles with longer TTL
      if (historicalCandles.length > 0) {
        await this.redis.setex(
          historicalKey,
          strategy.historicalTTL,
          JSON.stringify(historicalCandles)
        );
      }
    } catch (error) {
      console.error("Error caching candles:", error);
    }
  }

  async getLatestCandle(
    symbol: string,
    timeframe: Timeframe
  ): Promise<CandleData | null> {
    try {
      const key = this.getLatestKey(symbol, timeframe);
      const cached = await this.redis.get(key);

      if (!cached) return null;

      return JSON.parse(cached);
    } catch (error) {
      console.error("Error getting latest candle:", error);
      return null;
    }
  }

  async updateLatestCandle(
    symbol: string,
    timeframe: Timeframe,
    candle: CandleData
  ): Promise<void> {
    try {
      const key = this.getLatestKey(symbol, timeframe);
      await this.redis.setex(
        key,
        this.CACHE_STRATEGIES[timeframe].cacheTTL,
        JSON.stringify(candle)
      );
    } catch (error) {
      console.error("Error updating latest candle:", error);
    }
  }

  async getCachedAggregatedCandles(
    symbol: string,
    sourceTimeframe: Timeframe,
    targetTimeframe: Timeframe
  ): Promise<CandleData[] | null> {
    try {
      const key = this.getAggregateKey(
        symbol,
        sourceTimeframe,
        targetTimeframe
      );
      const cached = await this.redis.get(key);

      if (!cached) return null;

      return JSON.parse(cached);
    } catch (error) {
      console.error("Error getting cached aggregated candles:", error);
      return null;
    }
  }

  async cacheAggregatedCandles(
    symbol: string,
    sourceTimeframe: Timeframe,
    targetTimeframe: Timeframe,
    candles: CandleData[]
  ): Promise<void> {
    try {
      const key = this.getAggregateKey(
        symbol,
        sourceTimeframe,
        targetTimeframe
      );
      const strategy = this.CACHE_STRATEGIES[targetTimeframe];

      const limitedCandles = candles.slice(-strategy.maxCachedCandles);

      await this.redis.setex(
        key,
        strategy.cacheTTL,
        JSON.stringify(limitedCandles)
      );
    } catch (error) {
      console.error("Error caching aggregated candles:", error);
    }
  }

  async invalidateCache(symbol: string, timeframe: Timeframe): Promise<void> {
    try {
      const keys = [
        this.getCandleKey(symbol, timeframe),
        this.getLatestKey(symbol, timeframe),
      ];
      await this.redis.del(...keys);
    } catch (error) {
      console.error("Error invalidating cache:", error);
    }
  }

  async invalidateAggregateCache(
    symbol: string,
    sourceTimeframe: Timeframe,
    targetTimeframe: Timeframe
  ): Promise<void> {
    try {
      const key = this.getAggregateKey(
        symbol,
        sourceTimeframe,
        targetTimeframe
      );
      await this.redis.del(key);
    } catch (error) {
      console.error("Error invalidating aggregate cache:", error);
    }
  }

  private filterCandlesByTimeRange(
    candles: CandleData[],
    startTime?: number,
    endTime?: number
  ): CandleData[] {
    return candles.filter((candle) => {
      if (startTime && candle.time < startTime) return false;
      if (endTime && candle.time > endTime) return false;
      return true;
    });
  }

  private getCandleKey(symbol: string, timeframe: Timeframe): string {
    return `${this.CANDLE_PREFIX}${symbol}:${timeframe}`;
  }

  private getHistoricalKey(symbol: string, timeframe: Timeframe): string {
    return `${this.HISTORICAL_PREFIX}${symbol}:${timeframe}`;
  }

  private getLatestKey(symbol: string, timeframe: Timeframe): string {
    return `${this.LATEST_PREFIX}${symbol}:${timeframe}`;
  }

  private getAggregateKey(
    symbol: string,
    sourceTimeframe: Timeframe,
    targetTimeframe: Timeframe
  ): string {
    return `${this.AGGREGATE_PREFIX}${symbol}:${sourceTimeframe}:${targetTimeframe}`;
  }
}

export const redisService = new RedisService();
export default redisService;
