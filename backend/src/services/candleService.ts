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
  private lastBroadcastTime: Map<string, Date> = new Map();
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

      console.log(
        `Fetching candles from database for ${symbol} (${timeframe})`
      );

      // If no cache or data too old, query TimescaleDB
      let dbCandles;

      // First try to get the candles directly from the database (native timeframe)
      dbCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe,
          ...(startTime && { time: { gte: startTime } }),
          ...(endTime && { time: { lte: endTime } }),
        },
        orderBy: {
          time: "asc",
        },
        take: Math.min(limit, 1000),
        include: {
          symbol: true,
        },
      });

      // If we don't have enough data for the requested timeframe,
      // try to aggregate from a smaller timeframe
      if (dbCandles.length < limit && timeframe !== Timeframe.ONE_MINUTE) {
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
          extendedLimit
        );

        if (aggregatedCandles.length > 0) {
          // Filter by time range if specified
          const filteredCandles = aggregatedCandles.filter((candle) => {
            if (startTime && candle.time < startTime) return false;
            if (endTime && candle.time > endTime) return false;
            return true;
          });

          // Combine with any existing candles in the DB, removing duplicates
          const existingTimeMap = new Map(
            dbCandles.map((c) => [c.time.getTime(), c])
          );

          for (const candle of filteredCandles) {
            const timeKey = candle.time.getTime();
            if (!existingTimeMap.has(timeKey)) {
              // Make sure to include the symbol property
              dbCandles.push({
                ...candle,
                symbol: symbolRecord,
              });
            }
          }

          // Sort by time
          dbCandles.sort((a, b) => a.time.getTime() - b.time.getTime());

          // Limit to requested amount
          dbCandles = dbCandles.slice(0, limit);
        }
      }

      // Cache recent candles
      if (dbCandles.length > 0) {
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
      }

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
            gte: startDate,
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
}

export const candleService = new CandleService();
export default candleService;
