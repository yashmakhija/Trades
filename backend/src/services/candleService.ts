import { PrismaClient, OHLCV, Timeframe } from "@prisma/client";
import { WebSocketServer } from "ws";
import { redisService } from "./redisService";
import { config } from "../config";

const prisma = new PrismaClient();

/**
 * Service for handling candle data operations
 */
class CandleService {
  private wss: WebSocketServer | null = null;
  private readonly RETENTION_POLICIES = {
    [Timeframe.ONE_MINUTE]: {
      redis: 7 * 24 * 60 * 60, // 7 days in Redis
      timescale: 30 * 24 * 60 * 60, // 30 days in TimescaleDB
    },
    [Timeframe.FIVE_MINUTES]: {
      redis: 14 * 24 * 60 * 60,
      timescale: 90 * 24 * 60 * 60,
    },
    [Timeframe.TEN_MINUTES]: {
      redis: 30 * 24 * 60 * 60,
      timescale: 180 * 24 * 60 * 60,
    },
    [Timeframe.FIFTEEN_MINUTES]: {
      redis: 30 * 24 * 60 * 60,
      timescale: 180 * 24 * 60 * 60,
    },
    [Timeframe.THIRTY_MINUTES]: {
      redis: 60 * 24 * 60 * 60,
      timescale: 365 * 24 * 60 * 60,
    },
    [Timeframe.ONE_HOUR]: {
      redis: 90 * 24 * 60 * 60,
      timescale: 730 * 24 * 60 * 60,
    },
    [Timeframe.FOUR_HOURS]: {
      redis: 180 * 24 * 60 * 60,
      timescale: 1460 * 24 * 60 * 60,
    },
    [Timeframe.ONE_DAY]: {
      redis: 365 * 24 * 60 * 60,
      timescale: 3650 * 24 * 60 * 60,
    },
  };

  /**
   * Set the WebSocket server instance for real-time updates
   */
  setWebSocketServer(wss: WebSocketServer) {
    this.wss = wss;
    console.log("CandleService: WebSocket server set for real-time updates");
  }

  /**
   * Store a new candle and broadcast updates to connected clients
   */
  async storeCandle(
    symbol: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    timeframe: Timeframe = Timeframe.ONE_MINUTE,
    time: Date = new Date()
  ): Promise<OHLCV> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Store the candle in TimescaleDB
      const candle = await prisma.oHLCV.create({
        data: {
          symbolId: symbolRecord.id,
          open,
          high,
          low,
          close,
          volume,
          timeframe,
          time,
        },
      });

      // Update Redis cache
      await this.updateRedisCache(symbol, timeframe, candle);

      // Apply retention policy
      await this.applyRetentionPolicy(symbolRecord.id, timeframe);

      // Broadcast the update to WebSocket clients
      this.broadcastCandleUpdate(symbol, timeframe, candle);

      return candle;
    } catch (error) {
      console.error("Error storing candle:", error);
      throw error;
    }
  }

  /**
   * Get historical candles for a symbol and timeframe
   */
  async getCandles(
    symbol: string,
    timeframe: Timeframe = Timeframe.ONE_MINUTE,
    limit: number = 100,
    startTime?: Date,
    endTime?: Date
  ): Promise<OHLCV[]> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Try to get from Redis cache first
      const cachedCandles = await redisService.getCachedCandles(
        symbol,
        timeframe,
        startTime?.getTime(),
        endTime?.getTime()
      );

      if (cachedCandles) {
        return cachedCandles.map((candle) => ({
          id: `${symbolRecord.id}-${timeframe}-${candle.time}`,
          symbolId: symbolRecord.id,
          symbol: symbolRecord,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          timeframe,
          time: new Date(candle.time),
        }));
      }

      // If no cache or data too old, query TimescaleDB
      const dbCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
          time: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: {
          time: "asc",
        },
        take: Math.min(limit, 1000),
        include: {
          symbol: true,
        },
      });

      // Cache recent candles
      await redisService.cacheCandles(
        symbol,
        timeframe,
        dbCandles.map((candle) => ({
          time: candle.time.getTime(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }))
      );

      return dbCandles;
    } catch (error) {
      console.error("Error getting candles:", error);
      throw error;
    }
  }

  /**
   * Get the latest candle for a symbol and timeframe
   */
  async getLatestCandle(
    symbol: string,
    timeframe: Timeframe = Timeframe.ONE_MINUTE
  ): Promise<OHLCV | null> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Try to get from Redis cache first
      const cachedCandle = await redisService.getLatestCandle(
        symbol,
        timeframe
      );
      if (cachedCandle) {
        return {
          id: `${symbolRecord.id}-${timeframe}-${cachedCandle.time}`,
          symbolId: symbolRecord.id,
          open: cachedCandle.open,
          high: cachedCandle.high,
          low: cachedCandle.low,
          close: cachedCandle.close,
          volume: cachedCandle.volume,
          timeframe,
          time: new Date(cachedCandle.time),
        };
      }

      // If no cache, get from database
      const candle = await prisma.oHLCV.findFirst({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
        },
        orderBy: {
          time: "desc",
        },
        include: {
          symbol: true,
        },
      });

      // Cache the latest candle
      if (candle) {
        await redisService.updateLatestCandle(symbol, timeframe, {
          time: candle.time.getTime(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        });
      }

      return candle;
    } catch (error) {
      console.error("Error getting latest candle:", error);
      throw error;
    }
  }

  /**
   * Aggregate candles from a source timeframe to a target timeframe
   */
  async aggregateCandles(
    symbol: string,
    sourceTimeframe: Timeframe = Timeframe.ONE_MINUTE,
    targetTimeframe: Timeframe,
    limit: number = 100
  ): Promise<OHLCV[]> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Try to get from Redis cache first
      const cachedAggregates = await redisService.getCachedAggregatedCandles(
        symbol,
        sourceTimeframe,
        targetTimeframe
      );

      if (cachedAggregates) {
        return cachedAggregates.map((candle) => ({
          id: `${symbolRecord.id}-${targetTimeframe}-${candle.time}`,
          symbolId: symbolRecord.id,
          symbol: symbolRecord,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          timeframe: targetTimeframe,
          time: new Date(candle.time),
        }));
      }

      // Map timeframes to minutes
      const timeframeToMinutes: Record<Timeframe, number> = {
        [Timeframe.ONE_MINUTE]: 1,
        [Timeframe.FIVE_MINUTES]: 5,
        [Timeframe.TEN_MINUTES]: 10,
        [Timeframe.FIFTEEN_MINUTES]: 15,
        [Timeframe.THIRTY_MINUTES]: 30,
        [Timeframe.ONE_HOUR]: 60,
        [Timeframe.FOUR_HOURS]: 240,
        [Timeframe.ONE_DAY]: 1440,
      };

      const sourceMinutes = timeframeToMinutes[sourceTimeframe];
      const targetMinutes = timeframeToMinutes[targetTimeframe];

      if (targetMinutes <= sourceMinutes) {
        throw new Error(
          "Target timeframe must be larger than source timeframe"
        );
      }

      // Get the source candles from TimescaleDB
      const sourceCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe: sourceTimeframe,
        },
        orderBy: {
          time: "desc",
        },
        take: Math.min(limit * (targetMinutes / sourceMinutes), 1000),
        include: {
          symbol: true,
        },
      });

      if (sourceCandles.length === 0) {
        return [];
      }

      // Group candles by target timeframe
      const groupedCandles: Record<string, OHLCV[]> = {};

      sourceCandles.forEach((candle) => {
        const time = new Date(candle.time);
        // Round down to the nearest target timeframe
        const targetTime = new Date(
          time.getFullYear(),
          time.getMonth(),
          time.getDate(),
          time.getHours(),
          Math.floor(time.getMinutes() / targetMinutes) * targetMinutes
        );

        const key = targetTime.toISOString();

        if (!groupedCandles[key]) {
          groupedCandles[key] = [];
        }

        groupedCandles[key].push(candle);
      });

      // Aggregate candles
      const aggregatedCandles = Object.entries(groupedCandles).map(
        ([key, candles]) => {
          const time = new Date(key);
          const open = candles[0].open;
          const close = candles[candles.length - 1].close;
          const high = Math.max(...candles.map((c) => c.high));
          const low = Math.min(...candles.map((c) => c.low));
          const volume = candles.reduce((sum, c) => sum + c.volume, 0);

          return {
            id: `${symbolRecord.id}-${targetTimeframe}-${time.getTime()}`,
            symbolId: symbolRecord.id,
            symbol: symbolRecord,
            open,
            high,
            low,
            close,
            volume,
            timeframe: targetTimeframe,
            time,
          };
        }
      );

      // Cache the aggregated results
      await redisService.cacheAggregatedCandles(
        symbol,
        sourceTimeframe,
        targetTimeframe,
        aggregatedCandles.map((candle) => ({
          time: candle.time.getTime(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }))
      );

      return aggregatedCandles.sort(
        (a, b) => a.time.getTime() - b.time.getTime()
      );
    } catch (error) {
      console.error("Error aggregating candles:", error);
      throw error;
    }
  }

  /**
   * Update Redis cache with new candle data
   */
  private async updateRedisCache(
    symbol: string,
    timeframe: Timeframe,
    candle: OHLCV
  ): Promise<void> {
    try {
      // Update latest candle
      await redisService.updateLatestCandle(symbol, timeframe, {
        time: candle.time.getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });

      // Invalidate other caches
      await redisService.invalidateCache(symbol, timeframe);
    } catch (error) {
      console.error("Error updating Redis cache:", error);
    }
  }

  /**
   * Apply retention policy for a symbol and timeframe
   */
  private async applyRetentionPolicy(
    symbolId: string,
    timeframe: Timeframe
  ): Promise<void> {
    try {
      const policy = this.RETENTION_POLICIES[timeframe];
      const cutoffDate = new Date(Date.now() - policy.timescale * 1000);

      // Delete candles older than retention period from TimescaleDB
      await prisma.oHLCV.deleteMany({
        where: {
          symbolId,
          timeframe,
          time: {
            lt: cutoffDate,
          },
        },
      });
    } catch (error) {
      console.error("Error applying retention policy:", error);
    }
  }

  /**
   * Broadcast a candle update to WebSocket clients
   */
  private broadcastCandleUpdate(
    symbol: string,
    timeframe: Timeframe,
    candle: OHLCV
  ) {
    if (!this.wss) {
      return;
    }

    const message = JSON.stringify({
      type: "CANDLE_UPDATE",
      data: {
        symbol,
        timeframe,
        candle: {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        },
      },
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

export const candleService = new CandleService();
export default candleService;
