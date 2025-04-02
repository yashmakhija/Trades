import { PrismaClient, OHLCV, Timeframe } from "@prisma/client";
import { WebSocketServer } from "ws";
import { redisService } from "./redisService";
import { config } from "../config";

const prisma = new PrismaClient();

// Helper interface for tiered data access
interface TierConfig {
  type: "hot" | "warm" | "cold";
  maxAge: number; // in days
  useCompression: boolean;
  useContinuousAggregate: boolean;
}

/**
 * Service for handling candle data operations
 * Implements efficient storage and retrieval of all historical candle data
 */
class CandleService {
  private wss: WebSocketServer | null = null;
  private lastBroadcastTime: Map<string, Date> = new Map();

  // Modified retention policies to keep all data in TimescaleDB
  // Redis TTL times remain the same for caching efficiency
  private readonly RETENTION_POLICIES = {
    [Timeframe.ONE_MINUTE]: {
      redis: 7 * 24 * 60 * 60, // 7 days in Redis
      timescale: null, // Keep forever in TimescaleDB (null = no deletion)
      compression: 7 * 24 * 60 * 60, // Compress data older than 7 days
    },
    [Timeframe.FIVE_MINUTES]: {
      redis: 14 * 24 * 60 * 60,
      timescale: null,
      compression: 14 * 24 * 60 * 60,
    },
    [Timeframe.TEN_MINUTES]: {
      redis: 30 * 24 * 60 * 60,
      timescale: null,
      compression: 30 * 24 * 60 * 60,
    },
    [Timeframe.FIFTEEN_MINUTES]: {
      redis: 30 * 24 * 60 * 60,
      timescale: null,
      compression: 30 * 24 * 60 * 60,
    },
    [Timeframe.THIRTY_MINUTES]: {
      redis: 60 * 24 * 60 * 60,
      timescale: null,
      compression: 60 * 24 * 60 * 60,
    },
    [Timeframe.ONE_HOUR]: {
      redis: 90 * 24 * 60 * 60,
      timescale: null,
      compression: 90 * 24 * 60 * 60,
    },
    [Timeframe.FOUR_HOURS]: {
      redis: 180 * 24 * 60 * 60,
      timescale: null,
      compression: 180 * 24 * 60 * 60,
    },
    [Timeframe.ONE_DAY]: {
      redis: 365 * 24 * 60 * 60,
      timescale: null,
      compression: 365 * 24 * 60 * 60,
    },
  };

  // Chunk size configuration for different timeframes
  // This optimizes TimescaleDB chunk size based on data frequency
  private readonly CHUNK_INTERVALS = {
    [Timeframe.ONE_MINUTE]: "1 day", // 1440 records per chunk
    [Timeframe.FIVE_MINUTES]: "5 days", // 1440 records per chunk
    [Timeframe.TEN_MINUTES]: "10 days", // 1440 records per chunk
    [Timeframe.FIFTEEN_MINUTES]: "15 days", // 1440 records per chunk
    [Timeframe.THIRTY_MINUTES]: "30 days", // 1440 records per chunk
    [Timeframe.ONE_HOUR]: "60 days", // 1440 records per chunk
    [Timeframe.FOUR_HOURS]: "240 days", // 1440 records per chunk
    [Timeframe.ONE_DAY]: "365 days", // 365 records per chunk
  };

  // Add tiered storage configuration
  private readonly STORAGE_TIERS: Record<Timeframe, TierConfig[]> = {
    [Timeframe.ONE_MINUTE]: [
      {
        type: "hot",
        maxAge: 7,
        useCompression: false,
        useContinuousAggregate: false,
      },
      {
        type: "warm",
        maxAge: 30,
        useCompression: true,
        useContinuousAggregate: false,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: false,
      },
    ],
    [Timeframe.FIVE_MINUTES]: [
      {
        type: "hot",
        maxAge: 30,
        useCompression: false,
        useContinuousAggregate: true,
      },
      {
        type: "warm",
        maxAge: 90,
        useCompression: true,
        useContinuousAggregate: true,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: true,
      },
    ],
    [Timeframe.TEN_MINUTES]: [
      {
        type: "hot",
        maxAge: 30,
        useCompression: false,
        useContinuousAggregate: false,
      },
      {
        type: "warm",
        maxAge: 90,
        useCompression: true,
        useContinuousAggregate: false,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: false,
      },
    ],
    [Timeframe.FIFTEEN_MINUTES]: [
      {
        type: "hot",
        maxAge: 30,
        useCompression: false,
        useContinuousAggregate: true,
      },
      {
        type: "warm",
        maxAge: 180,
        useCompression: true,
        useContinuousAggregate: true,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: true,
      },
    ],
    [Timeframe.THIRTY_MINUTES]: [
      {
        type: "hot",
        maxAge: 60,
        useCompression: false,
        useContinuousAggregate: false,
      },
      {
        type: "warm",
        maxAge: 180,
        useCompression: true,
        useContinuousAggregate: false,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: false,
      },
    ],
    [Timeframe.ONE_HOUR]: [
      {
        type: "hot",
        maxAge: 90,
        useCompression: false,
        useContinuousAggregate: true,
      },
      {
        type: "warm",
        maxAge: 365,
        useCompression: true,
        useContinuousAggregate: true,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: true,
      },
    ],
    [Timeframe.FOUR_HOURS]: [
      {
        type: "hot",
        maxAge: 180,
        useCompression: false,
        useContinuousAggregate: false,
      },
      {
        type: "warm",
        maxAge: 365,
        useCompression: true,
        useContinuousAggregate: false,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: false,
      },
    ],
    [Timeframe.ONE_DAY]: [
      {
        type: "hot",
        maxAge: 365,
        useCompression: false,
        useContinuousAggregate: true,
      },
      {
        type: "warm",
        maxAge: 730,
        useCompression: true,
        useContinuousAggregate: true,
      },
      {
        type: "cold",
        maxAge: Number.POSITIVE_INFINITY,
        useCompression: true,
        useContinuousAggregate: true,
      },
    ],
  };

  // Map of timeframes to continuous aggregate function names
  private readonly CONTINUOUS_AGGREGATES: Partial<Record<Timeframe, string>> = {
    [Timeframe.FIVE_MINUTES]: "continuous_aggregate_5m",
    [Timeframe.FIFTEEN_MINUTES]: "continuous_aggregate_15m",
    [Timeframe.ONE_HOUR]: "continuous_aggregate_1h",
    [Timeframe.ONE_DAY]: "continuous_aggregate_1d",
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

      // Round the time to the nearest minute for 1m timeframe
      // For other timeframes, round to the appropriate interval
      const roundedTime = new Date(time);
      const minutes = roundedTime.getMinutes();
      const hours = roundedTime.getHours();
      const days = roundedTime.getDate();

      switch (timeframe) {
        case Timeframe.ONE_MINUTE:
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.FIVE_MINUTES:
          roundedTime.setMinutes(Math.floor(minutes / 5) * 5);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.TEN_MINUTES:
          roundedTime.setMinutes(Math.floor(minutes / 10) * 10);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.FIFTEEN_MINUTES:
          roundedTime.setMinutes(Math.floor(minutes / 15) * 15);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.THIRTY_MINUTES:
          roundedTime.setMinutes(Math.floor(minutes / 30) * 30);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.ONE_HOUR:
          roundedTime.setMinutes(0);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.FOUR_HOURS:
          roundedTime.setHours(Math.floor(hours / 4) * 4);
          roundedTime.setMinutes(0);
          roundedTime.setSeconds(0, 0);
          break;
        case Timeframe.ONE_DAY:
          roundedTime.setHours(0);
          roundedTime.setMinutes(0);
          roundedTime.setSeconds(0, 0);
          break;
      }

      // Check for existing candle with the same rounded timestamp
      const existingCandle = await prisma.oHLCV.findFirst({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
          time: roundedTime,
        },
      });

      let candle: OHLCV;
      if (existingCandle) {
        // Update existing candle with aggregated values
        candle = await prisma.oHLCV.update({
          where: {
            id_time: {
              id: existingCandle.id,
              time: existingCandle.time,
            },
          },
          data: {
            high: Math.max(existingCandle.high, high),
            low: Math.min(existingCandle.low, low),
            close: close,
            volume: existingCandle.volume + volume,
          },
        });
      } else {
        // Create new candle with rounded time
        candle = await prisma.oHLCV.create({
          data: {
            symbolId: symbolRecord.id,
            open,
            high,
            low,
            close,
            volume,
            timeframe,
            time: roundedTime,
          },
        });
      }

      // Update Redis cache
      await this.updateRedisCache(symbol, timeframe, candle);

      // Apply compression policy instead of retention policy
      await this.applyCompressionPolicy(symbolRecord.id, timeframe);

      // Broadcast the update to WebSocket clients
      this.broadcastCandleUpdate(symbol, timeframe, candle);

      return candle;
    } catch (error) {
      console.error("Error storing candle:", error);
      throw error;
    }
  }

  /**
   * Get historical candles for a symbol and timeframe with pagination support
   * Enhanced with tiered storage access and continuous aggregates
   */
  async getCandles(
    symbol: string,
    timeframe: Timeframe = Timeframe.ONE_MINUTE,
    limit: number = 100,
    startTime?: Date,
    endTime?: Date,
    page: number = 0
  ): Promise<OHLCV[]> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // For recent data (no startTime specified or startTime is within Redis cache window)
      // try Redis cache first
      const cacheWindowStart = new Date(
        Date.now() - this.RETENTION_POLICIES[timeframe].redis * 1000
      );

      if (!startTime || startTime >= cacheWindowStart) {
        // Try to get from Redis cache first
        const cachedCandles = await redisService.getCachedCandles(
          symbol,
          timeframe,
          startTime?.getTime(),
          endTime?.getTime()
        );

        if (cachedCandles && cachedCandles.length > 0) {
          console.log(`Using cached candles for ${symbol} (${timeframe})`);
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
      }

      console.log(
        `Fetching candles from database for ${symbol} (${timeframe})`
      );

      // Calculate the offset if pagination is used
      const offset = page * limit;

      // Determine which storage tier to use based on date range
      const now = new Date();
      const dataAge = startTime
        ? Math.floor(
            (now.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000)
          )
        : 0;

      let selectedTier: TierConfig | undefined;
      for (const tier of this.STORAGE_TIERS[timeframe]) {
        if (dataAge <= tier.maxAge) {
          selectedTier = tier;
          break;
        }
      }

      // If we don't have a tier (shouldn't happen) or date is very old, use cold storage
      if (!selectedTier) {
        selectedTier =
          this.STORAGE_TIERS[timeframe][
            this.STORAGE_TIERS[timeframe].length - 1
          ];
      }

      console.log(
        `Using ${selectedTier.type} storage tier for ${timeframe} data`
      );

      // Check if we can use continuous aggregates for this query
      const canUseContAgg =
        selectedTier.useContinuousAggregate &&
        this.CONTINUOUS_AGGREGATES[timeframe] !== undefined;

      let dbCandles;

      if (canUseContAgg) {
        // Use continuous aggregate function for optimized data retrieval
        console.log(`Using continuous aggregate for ${timeframe}`);

        const timeframeStr = this.mapTimeframeToString(timeframe);

        // Use raw SQL with the prebuilt function to get data from continuous aggregates
        dbCandles = await prisma.$queryRaw`
          SELECT * FROM get_aggregate_candles(
            ${symbolRecord.id}::TEXT, 
            ${timeframeStr}::TEXT, 
            ${startTime || new Date(0)}::TIMESTAMPTZ, 
            ${endTime || new Date()}::TIMESTAMPTZ
          )
          ORDER BY time DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        // Transform the raw results to match our OHLCV structure
        dbCandles = (dbCandles as any[]).map((row) => ({
          id: `${symbolRecord.id}-${timeframe}-${row.time.getTime()}`,
          symbolId: symbolRecord.id,
          symbol: symbolRecord,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume),
          timeframe,
          time: new Date(row.time),
        }));
      } else {
        // Fall back to standard query if continuous aggregates not available
        dbCandles = await prisma.oHLCV.findMany({
          where: {
            symbolId: symbolRecord.id,
            timeframe,
            ...(startTime && { time: { gte: startTime } }),
            ...(endTime && { time: { lte: endTime } }),
          },
          orderBy: {
            time: "desc", // Latest candles first for pagination efficiency
          },
          skip: offset,
          take: limit,
          include: {
            symbol: true,
          },
        });
      }

      // If we don't have enough data for the requested timeframe in storage,
      // try to aggregate from a smaller timeframe
      if (
        dbCandles.length < limit &&
        timeframe !== Timeframe.ONE_MINUTE &&
        page === 0
      ) {
        console.log(
          `Not enough ${timeframe} candles, aggregating from smaller timeframe`
        );

        // Get source candles with extended range to ensure we have enough data
        const sourceTimeframe = this.getNextSmallerTimeframe(timeframe);
        const extendedLimit =
          limit * this.getTimeframeRatio(sourceTimeframe, timeframe);

        const aggregatedCandles = await this.aggregateCandles(
          symbol,
          sourceTimeframe,
          timeframe,
          extendedLimit,
          startTime,
          endTime
        );

        if (aggregatedCandles.length > 0) {
          // Cache these aggregated candles for future use if they're recent
          if (!startTime || startTime >= cacheWindowStart) {
            await redisService.cacheAggregatedCandles(
              symbol,
              sourceTimeframe,
              timeframe,
              aggregatedCandles.map((c) => ({
                time: c.time.getTime(),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume,
              }))
            );
          }

          // Sort in descending order for consistency
          return aggregatedCandles.sort(
            (a, b) => b.time.getTime() - a.time.getTime()
          );
        }
      }

      // If requested in ascending order (for charts), reverse the results
      if (page === 0) {
        return dbCandles.reverse(); // Reverse to get ascending order for charts
      }

      return dbCandles;
    } catch (error) {
      console.error("Error getting candles:", error);
      throw error;
    }
  }

  /**
   * Get count of available candles for pagination
   */
  async getCandleCount(
    symbol: string,
    timeframe: Timeframe,
    startTime?: Date,
    endTime?: Date
  ): Promise<number> {
    try {
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      const count = await prisma.oHLCV.count({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
          ...(startTime && { time: { gte: startTime } }),
          ...(endTime && { time: { lte: endTime } }),
        },
      });

      return count;
    } catch (error) {
      console.error("Error getting candle count:", error);
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
      const cachedAggregates = await redisService.getCachedAggregatedCandles(
        symbol,
        sourceTimeframe,
        targetTimeframe
      );

      if (cachedAggregates && cachedAggregates.length > 0) {
        console.log(
          `Using cached aggregated candles for ${symbol} (${sourceTimeframe} -> ${targetTimeframe})`
        );
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

      const ratio = targetMinutes / sourceMinutes;
      const neededSourceCandles = limit * ratio;

      console.log(
        `Aggregating ${sourceTimeframe} to ${targetTimeframe} candles for ${symbol} (ratio: ${ratio}, needed: ${neededSourceCandles})`
      );

      // Calculate a reasonable time range to fetch source candles
      const now = new Date();
      const timeRangeMs = neededSourceCandles * sourceMinutes * 60 * 1000;
      const startDate = new Date(now.getTime() - timeRangeMs);

      // Get the source candles from TimescaleDB with more organized query
      const sourceCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe: sourceTimeframe,
          time: {
            gte: startTime || startDate,
          },
        },
        orderBy: {
          time: "asc",
        },
        take: Math.min(neededSourceCandles, 5000), // Limit to prevent excessive DB load
        include: {
          symbol: true,
        },
      });

      console.log(
        `Found ${sourceCandles.length} source candles for aggregation`
      );

      if (sourceCandles.length === 0) {
        return [];
      }

      // Group candles by target timeframe
      const groupedCandles: Record<string, OHLCV[]> = {};

      sourceCandles.forEach((candle) => {
        const time = new Date(candle.time);

        // Calculate target time by rounding down to the nearest target timeframe interval
        let targetTime: Date;

        if (targetTimeframe === Timeframe.ONE_DAY) {
          // For daily candles, round to midnight UTC
          targetTime = new Date(
            Date.UTC(
              time.getUTCFullYear(),
              time.getUTCMonth(),
              time.getUTCDate(),
              0,
              0,
              0,
              0
            )
          );
        } else if (targetTimeframe === Timeframe.FOUR_HOURS) {
          // For 4h candles, round to 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
          const hours = Math.floor(time.getUTCHours() / 4) * 4;
          targetTime = new Date(
            Date.UTC(
              time.getUTCFullYear(),
              time.getUTCMonth(),
              time.getUTCDate(),
              hours,
              0,
              0,
              0
            )
          );
        } else if (targetTimeframe === Timeframe.ONE_HOUR) {
          // For hourly candles, round to the start of the hour
          targetTime = new Date(
            Date.UTC(
              time.getUTCFullYear(),
              time.getUTCMonth(),
              time.getUTCDate(),
              time.getUTCHours(),
              0,
              0,
              0
            )
          );
        } else {
          // For smaller timeframes, round to the nearest target minutes
          const minutes =
            Math.floor(time.getUTCMinutes() / targetMinutes) * targetMinutes;
          targetTime = new Date(
            Date.UTC(
              time.getUTCFullYear(),
              time.getUTCMonth(),
              time.getUTCDate(),
              time.getUTCHours(),
              minutes,
              0,
              0
            )
          );
        }

        const key = targetTime.toISOString();

        if (!groupedCandles[key]) {
          groupedCandles[key] = [];
        }

        groupedCandles[key].push(candle);
      });

      // Aggregate candles
      const aggregatedCandles = Object.entries(groupedCandles)
        .map(([key, candles]) => {
          if (candles.length === 0) return null;

          const time = new Date(key);
          const sortedCandles = [...candles].sort(
            (a, b) => a.time.getTime() - b.time.getTime()
          );

          const open = sortedCandles[0].open;
          const close = sortedCandles[sortedCandles.length - 1].close;
          const high = Math.max(...sortedCandles.map((c) => c.high));
          const low = Math.min(...sortedCandles.map((c) => c.low));
          const volume = sortedCandles.reduce((sum, c) => sum + c.volume, 0);

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
        })
        .filter(Boolean) as OHLCV[];

      // Sort chronologically
      aggregatedCandles.sort((a, b) => a.time.getTime() - b.time.getTime());

      console.log(
        `Generated ${aggregatedCandles.length} aggregated ${targetTimeframe} candles`
      );

      // Store the newly aggregated candles in the database to speed up future requests
      if (aggregatedCandles.length > 0) {
        try {
          console.log(
            `Storing ${aggregatedCandles.length} aggregated candles in database`
          );
          for (const candle of aggregatedCandles) {
            // Extract the symbol object to avoid type error
            const { symbol: _, ...candleData } = candle as any;
            await prisma.oHLCV
              .upsert({
                where: {
                  id_time: {
                    id: candleData.id,
                    time: candleData.time,
                  },
                },
                update: {
                  open: candleData.open,
                  high: candleData.high,
                  low: candleData.low,
                  close: candleData.close,
                  volume: candleData.volume,
                },
                create: {
                  id: candleData.id,
                  symbolId: candleData.symbolId,
                  open: candleData.open,
                  high: candleData.high,
                  low: candleData.low,
                  close: candleData.close,
                  volume: candleData.volume,
                  timeframe: candleData.timeframe,
                  time: candleData.time,
                },
              })
              .catch((e) => {
                // Catch errors for individual candles to prevent entire operation from failing
                console.warn(`Failed to store aggregated candle: ${e.message}`);
              });
          }
        } catch (storeError) {
          console.error("Error storing aggregated candles:", storeError);
          // Continue even if storage fails - we still want to return the aggregated data
        }
      }

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

      // Return only the requested number of most recent candles
      return aggregatedCandles.slice(-limit);
    } catch (error) {
      console.error(
        `Error aggregating candles from ${sourceTimeframe} to ${targetTimeframe}:`,
        error
      );
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
   * Apply compression policy for a symbol and timeframe
   * Instead of deleting old data, we compress it for storage efficiency
   */
  private async applyCompressionPolicy(
    symbolId: string,
    timeframe: Timeframe
  ): Promise<void> {
    try {
      const policy = this.RETENTION_POLICIES[timeframe];

      // Skip if no compression policy
      if (!policy.compression) return;

      // TimescaleDB compression is implemented at the database level
      // Here we're just logging the action - actual compression is handled by
      // TimescaleDB's policies configured in init-timescaledb.sql
      console.log(`Compression policy applied for ${symbolId} (${timeframe})`);
    } catch (error) {
      console.error("Error applying compression policy:", error);
    }
  }

  /**
   * Broadcast a candle update to all connected clients via WebSocket
   */
  private broadcastCandleUpdate(
    symbol: string,
    timeframe: Timeframe,
    candle: OHLCV
  ): void {
    if (!this.wss) {
      console.warn("WebSocket server not initialized, can't broadcast updates");
      return;
    }

    // Map timeframe enum to string for client-friendly format
    const timeframeMap: Record<Timeframe, string> = {
      [Timeframe.ONE_MINUTE]: "1m",
      [Timeframe.FIVE_MINUTES]: "5m",
      [Timeframe.TEN_MINUTES]: "10m",
      [Timeframe.FIFTEEN_MINUTES]: "15m",
      [Timeframe.THIRTY_MINUTES]: "30m",
      [Timeframe.ONE_HOUR]: "1h",
      [Timeframe.FOUR_HOURS]: "4h",
      [Timeframe.ONE_DAY]: "1d",
    };

    // Get client-friendly timeframe string
    const timeframeStr = timeframeMap[timeframe];

    console.log(
      `Broadcasting ${timeframeStr} candle update for ${symbol} at ${candle.time.toISOString()}`
    );

    // Use the WebSocket service to broadcast the update
    import("./webSocketService").then((module) => {
      module.broadcastOHLCVUpdate(symbol, timeframeStr, {
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
    });

    // Save current broadcast time for this symbol+timeframe
    const key = `${symbol}-${timeframe}`;
    this.lastBroadcastTime.set(key, new Date());

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(
          JSON.stringify({
            type: "CANDLE_UPDATE",
            symbol,
            timeframe: timeframeStr,
            data: {
              time: Math.floor(candle.time.getTime() / 1000), // Convert to Unix timestamp
              open: candle.open / 100, // Convert to dollars for frontend display
              high: candle.high / 100,
              low: candle.low / 100,
              close: candle.close / 100,
              volume: candle.volume / 100,
            },
          })
        );
      }
    });

    // When we receive a new 1-minute candle, also update higher timeframes
    if (timeframe === Timeframe.ONE_MINUTE) {
      this.updateHigherTimeframes(symbol, candle);
    }
  }

  /**
   * Update higher timeframes when a new 1-minute candle is received
   */
  private async updateHigherTimeframes(symbol: string, candle: OHLCV) {
    try {
      // Get current time
      const candleTime = candle.time;

      // Check if this candle should trigger an update for higher timeframes
      const minute = candleTime.getMinutes();
      const hour = candleTime.getHours();
      const day = candleTime.getDate();

      console.log(
        `Checking timeframe updates for ${symbol} at ${candleTime.toISOString()}`
      );

      // Update all timeframes as needed
      const updates = [];

      // Check 5-minute boundary
      if (minute % 5 === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.FIVE_MINUTES, candleTime)
        );
      }

      // Check 10-minute boundary
      if (minute % 10 === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.TEN_MINUTES, candleTime)
        );
      }

      // Check 15-minute boundary
      if (minute % 15 === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.FIFTEEN_MINUTES, candleTime)
        );
      }

      // Check 30-minute boundary
      if (minute % 30 === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.THIRTY_MINUTES, candleTime)
        );
      }

      // Check hourly boundary
      if (minute === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.ONE_HOUR, candleTime)
        );
      }

      // Check 4-hour boundary
      if (minute === 0 && hour % 4 === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.FOUR_HOURS, candleTime)
        );
      }

      // Check daily boundary
      if (minute === 0 && hour === 0) {
        updates.push(
          this.updateTimeframe(symbol, Timeframe.ONE_DAY, candleTime)
        );
      }

      // Run all the timeframe updates in parallel
      await Promise.all(updates);
    } catch (error) {
      console.error("Error updating higher timeframes:", error);
    }
  }

  /**
   * Update a specific timeframe
   */
  private async updateTimeframe(
    symbol: string,
    timeframe: Timeframe,
    endTime: Date
  ) {
    try {
      // Get the symbol record
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        console.error(`Symbol ${symbol} not found`);
        return;
      }

      // Calculate the start time for this timeframe
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

      const minutesInTimeframe = timeframeToMinutes[timeframe];

      // Create a new Date object to avoid modifying the original
      const boundaryTime = new Date(endTime);

      // Reset to exact boundary (always start with resetting milliseconds and seconds)
      boundaryTime.setMilliseconds(0);
      boundaryTime.setSeconds(0);

      // Adjust time based on timeframe using more precise calculations
      switch (timeframe) {
        case Timeframe.FIVE_MINUTES:
          boundaryTime.setMinutes(
            Math.floor(boundaryTime.getMinutes() / 5) * 5
          );
          break;
        case Timeframe.TEN_MINUTES:
          boundaryTime.setMinutes(
            Math.floor(boundaryTime.getMinutes() / 10) * 10
          );
          break;
        case Timeframe.FIFTEEN_MINUTES:
          boundaryTime.setMinutes(
            Math.floor(boundaryTime.getMinutes() / 15) * 15
          );
          break;
        case Timeframe.THIRTY_MINUTES:
          boundaryTime.setMinutes(
            Math.floor(boundaryTime.getMinutes() / 30) * 30
          );
          break;
        case Timeframe.ONE_HOUR:
          boundaryTime.setMinutes(0); // Reset minutes for hourly candles
          break;
        case Timeframe.FOUR_HOURS:
          boundaryTime.setMinutes(0);
          boundaryTime.setHours(Math.floor(boundaryTime.getHours() / 4) * 4);
          break;
        case Timeframe.ONE_DAY:
          boundaryTime.setMinutes(0);
          boundaryTime.setHours(0);
          break;
        default:
          // For 1-minute candles, we don't need special handling
          break;
      }

      // Calculate exact start time for data aggregation
      const startTime = new Date(boundaryTime);
      startTime.setMinutes(startTime.getMinutes() - minutesInTimeframe);

      console.log(
        `[UpdateTimeframe] ${timeframe} for ${symbol}: ${startTime.toISOString()} to ${boundaryTime.toISOString()}`
      );

      // Get all 1-minute candles in this timeframe period with improved error handling
      const sourceCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe: Timeframe.ONE_MINUTE,
          time: {
            gte: startTime,
            lt: boundaryTime,
          },
        },
        orderBy: {
          time: "asc",
        },
      });

      // Check if we have enough data for this timeframe
      const expectedCandleCount = minutesInTimeframe;
      const actualCandleCount = sourceCandles.length;

      console.log(
        `[UpdateTimeframe] Found ${actualCandleCount}/${expectedCandleCount} 1-minute candles for ${timeframe} aggregation`
      );

      // For higher timeframes, allow partial aggregation if we have at least 25% of expected candles
      const minimumRequiredCandles = Math.max(
        1,
        Math.ceil(expectedCandleCount * 0.25)
      );

      if (actualCandleCount < minimumRequiredCandles) {
        console.log(
          `[UpdateTimeframe] Not enough 1-minute candles for ${timeframe} aggregation (${actualCandleCount}/${minimumRequiredCandles} minimum)`
        );
        return;
      }

      // Ensure candles are sorted by time
      sourceCandles.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Aggregate the candles
      const open = sourceCandles[0].open;
      const high = Math.max(...sourceCandles.map((c) => c.high));
      const low = Math.min(...sourceCandles.map((c) => c.low));
      const close = sourceCandles[sourceCandles.length - 1].close;
      const volume = sourceCandles.reduce((sum, c) => sum + c.volume, 0);

      console.log(
        `[UpdateTimeframe] Aggregated ${timeframe} candle for ${symbol}: O:${open / 100} H:${high / 100} L:${low / 100} C:${close / 100} V:${volume / 100}`
      );

      // Check if we already have a candle for this timeframe and boundary
      const existingCandle = await prisma.oHLCV.findFirst({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
          time: boundaryTime,
        },
      });

      let candle;

      if (existingCandle) {
        // Update existing candle
        candle = await prisma.oHLCV.update({
          where: {
            id_time: {
              id: existingCandle.id,
              time: existingCandle.time,
            },
          },
          data: {
            open,
            high,
            low,
            close,
            volume,
          },
        });

        console.log(
          `[UpdateTimeframe] Updated ${timeframe} candle for ${symbol} at ${boundaryTime.toISOString()}`
        );
      } else {
        // Create new candle
        candle = await prisma.oHLCV.create({
          data: {
            symbolId: symbolRecord.id,
            open,
            high,
            low,
            close,
            volume,
            timeframe,
            time: boundaryTime,
          },
        });

        console.log(
          `[UpdateTimeframe] Created new ${timeframe} candle for ${symbol} at ${boundaryTime.toISOString()}`
        );
      }

      // Broadcast the update
      this.broadcastCandleUpdate(symbol, timeframe, candle);

      // Update Redis cache for this timeframe
      await this.updateRedisCache(symbol, timeframe, candle);

      return candle;
    } catch (error) {
      console.error(
        `[UpdateTimeframe] Error updating ${timeframe} for ${symbol}:`,
        error
      );
    }
  }

  /**
   * Get the next smaller timeframe for a given timeframe
   */
  private getNextSmallerTimeframe(timeframe: Timeframe): Timeframe {
    switch (timeframe) {
      case Timeframe.ONE_DAY:
        return Timeframe.FOUR_HOURS;
      case Timeframe.FOUR_HOURS:
        return Timeframe.ONE_HOUR;
      case Timeframe.ONE_HOUR:
        return Timeframe.THIRTY_MINUTES;
      case Timeframe.THIRTY_MINUTES:
        return Timeframe.FIFTEEN_MINUTES;
      case Timeframe.FIFTEEN_MINUTES:
        return Timeframe.TEN_MINUTES;
      case Timeframe.TEN_MINUTES:
        return Timeframe.FIVE_MINUTES;
      case Timeframe.FIVE_MINUTES:
        return Timeframe.ONE_MINUTE;
      default:
        return Timeframe.ONE_MINUTE;
    }
  }

  /**
   * Get the ratio between two timeframes
   */
  private getTimeframeRatio(smaller: Timeframe, larger: Timeframe): number {
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

    return timeframeToMinutes[larger] / timeframeToMinutes[smaller];
  }

  /**
   * Initialize TimescaleDB chunk sizes and compression policies
   * This should be called at application startup
   */
  async initializeTimescaleDBPolicies(): Promise<void> {
    try {
      console.log("Initializing TimescaleDB policies for candle data storage");

      // This method delegates to a SQL script that will
      // be executed separately via scripts/init-timescaledb.sql

      // Log potential chunks and compression settings for monitoring
      for (const timeframe of Object.keys(this.CHUNK_INTERVALS)) {
        console.log(
          `TimescaleDB ${timeframe} chunk interval: ${
            this.CHUNK_INTERVALS[timeframe as Timeframe]
          }`
        );
      }
    } catch (error) {
      console.error("Error initializing TimescaleDB policies:", error);
    }
  }

  /**
   * Map timeframe enum to string representation for SQL functions
   */
  private mapTimeframeToString(timeframe: Timeframe): string {
    switch (timeframe) {
      case Timeframe.FIVE_MINUTES:
        return "5m";
      case Timeframe.FIFTEEN_MINUTES:
        return "15m";
      case Timeframe.ONE_HOUR:
        return "1h";
      case Timeframe.ONE_DAY:
        return "1d";
      default:
        return "1m";
    }
  }

  /**
   * Initialize continuous aggregates and initial data
   * This should be called during system startup to populate continuous aggregates
   */
  async initializeContinuousAggregates(): Promise<void> {
    try {
      console.log("Initializing continuous aggregates for OHLCV data");

      // Execute raw SQL to refresh continuous aggregates
      await prisma.$executeRaw`CALL refresh_continuous_aggregate('continuous_aggregate_5m', NULL, NULL)`;
      await prisma.$executeRaw`CALL refresh_continuous_aggregate('continuous_aggregate_15m', NULL, NULL)`;
      await prisma.$executeRaw`CALL refresh_continuous_aggregate('continuous_aggregate_1h', NULL, NULL)`;
      await prisma.$executeRaw`CALL refresh_continuous_aggregate('continuous_aggregate_1d', NULL, NULL)`;

      console.log("Continuous aggregates refreshed successfully");
    } catch (error) {
      console.error("Error initializing continuous aggregates:", error);
    }
  }
}

// Export singleton instance
export const candleService = new CandleService();
export default candleService;
