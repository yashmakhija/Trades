import Redis from "ioredis";
import { Timeframe, OHLCV } from "@prisma/client";
import { config } from "../config";

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
}

class RedisService {
  private redis: Redis;
  private readonly CACHE_STRATEGIES: Record<Timeframe, CacheStrategy> = {
    [Timeframe.ONE_MINUTE]: {
      cacheTTL: 60,
      maxCachedCandles: 1000,
    },
    [Timeframe.FIVE_MINUTES]: {
      cacheTTL: 300,
      maxCachedCandles: 800,
    },
    [Timeframe.TEN_MINUTES]: {
      cacheTTL: 600,
      maxCachedCandles: 700,
    },
    [Timeframe.FIFTEEN_MINUTES]: {
      cacheTTL: 900,
      maxCachedCandles: 600,
    },
    [Timeframe.THIRTY_MINUTES]: {
      cacheTTL: 1800,
      maxCachedCandles: 500,
    },
    [Timeframe.ONE_HOUR]: {
      cacheTTL: 3600,
      maxCachedCandles: 400,
    },
    [Timeframe.FOUR_HOURS]: {
      cacheTTL: 14400,
      maxCachedCandles: 300,
    },
    [Timeframe.ONE_DAY]: {
      cacheTTL: 86400,
      maxCachedCandles: 200,
    },
  };

  private readonly CANDLE_PREFIX = "candle:";
  private readonly AGGREGATE_PREFIX = "aggregate:";
  private readonly LATEST_PREFIX = "latest:";

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
      const key = this.getCandleKey(symbol, timeframe);
      const cached = await this.redis.get(key);

      if (!cached) return null;

      const candles: CandleData[] = JSON.parse(cached);

      if (startTime || endTime) {
        return candles.filter((candle) => {
          if (startTime && candle.time < startTime) return false;
          if (endTime && candle.time > endTime) return false;
          return true;
        });
      }

      return candles;
    } catch (error) {
      console.error("Error getting cached candles:", error);
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

      const limitedCandles = candles.slice(-strategy.maxCachedCandles);

      await this.redis.setex(
        key,
        strategy.cacheTTL,
        JSON.stringify(limitedCandles)
      );
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

  private getCandleKey(symbol: string, timeframe: Timeframe): string {
    return `${this.CANDLE_PREFIX}${symbol}:${timeframe}`;
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
