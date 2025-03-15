import { PrismaClient, OHLCV, Timeframe } from "@prisma/client";
import { WebSocketServer } from "ws";

const prisma = new PrismaClient();

/**
 * Service for handling candle data operations
 */
class CandleService {
  private wss: WebSocketServer | null = null;

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

      // Store the candle
      const candle = await prisma.oHLCV.create({
        data: {
          symbol,
          open,
          high,
          low,
          close,
          volume,
          timeframe,
          time,
        },
      });

      // Apply retention policy - keep only the last 100 candles per symbol/timeframe
      const count = await prisma.oHLCV.count({
        where: {
          symbol,
          timeframe,
        },
      });

      if (count > 100) {
        // Delete the oldest candles beyond the 100 limit
        const oldestCandles = await prisma.oHLCV.findMany({
          where: {
            symbol,
            timeframe,
          },
          orderBy: {
            time: "asc",
          },
          take: count - 100,
        });

        if (oldestCandles.length > 0) {
          await prisma.oHLCV.deleteMany({
            where: {
              id: {
                in: oldestCandles.map((c) => c.id),
              },
            },
          });
        }
      }

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

      // Get the candles
      const candles = await prisma.oHLCV.findMany({
        where: {
          symbol,
          timeframe,
        },
        orderBy: {
          time: "desc",
        },
        take: Math.min(limit, 100), // Limit to 100 candles max
      });

      return candles.reverse(); // Return in ascending order by time
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

      // Get the latest candle
      const candle = await prisma.oHLCV.findFirst({
        where: {
          symbol,
          timeframe,
        },
        orderBy: {
          time: "desc",
        },
      });

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
  ): Promise<any[]> {
    try {
      // Check if the symbol exists
      const symbolRecord = await prisma.symbol.findUnique({
        where: { name: symbol },
      });

      if (!symbolRecord) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // For TimescaleDB, we would use the continuous aggregates
      // For now, we'll use a simple approach with raw SQL

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

      // Get the source candles
      const sourceCandles = await this.getCandles(
        symbol,
        sourceTimeframe,
        limit * (targetMinutes / sourceMinutes)
      );

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

          return {
            time,
            open: candles[0].open,
            high: Math.max(...candles.map((c) => c.high)),
            low: Math.min(...candles.map((c) => c.low)),
            close: candles[candles.length - 1].close,
            volume: candles.reduce((sum, c) => sum + c.volume, 0),
          };
        }
      );

      // Sort by time
      aggregatedCandles.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Limit the result
      return aggregatedCandles.slice(-limit);
    } catch (error) {
      console.error("Error aggregating candles:", error);
      throw error;
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
