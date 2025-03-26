import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

// Define enum for timeframes to match Prisma schema
enum Timeframe {
  ONE_MINUTE = "ONE_MINUTE",
  FIVE_MINUTES = "FIVE_MINUTES",
  TEN_MINUTES = "TEN_MINUTES",
  FIFTEEN_MINUTES = "FIFTEEN_MINUTES",
  THIRTY_MINUTES = "THIRTY_MINUTES",
  ONE_HOUR = "ONE_HOUR",
  FOUR_HOURS = "FOUR_HOURS",
  ONE_DAY = "ONE_DAY",
}

/**
 * Map string timeframe to Timeframe enum
 */
function mapTimeframe(timeframe: string): Timeframe {
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

// Define interface for transformed candle data
interface TransformedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Get historical candle data for a symbol
 * @route GET /api/candles
 */
export async function getCandles(req: Request, res: Response): Promise<void> {
  try {
    const {
      symbol,
      timeframe = "1m",
      limit = "100",
      startTime,
      endTime,
    } = req.query;

    // Validate inputs
    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Convert limit to number with a maximum of 1000
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

    // Map timeframe string to enum
    const tf = mapTimeframe(timeframe as string);

    // Parse time range if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startTime) {
      startDate = new Date(startTime as string);
      if (isNaN(startDate.getTime())) {
        res.status(400).json({ error: "Invalid startTime format" });
        return;
      }
    }

    if (endTime) {
      endDate = new Date(endTime as string);
      if (isNaN(endDate.getTime())) {
        res.status(400).json({ error: "Invalid endTime format" });
        return;
      }
    }

    // Find the symbol ID
    const symbolRecord = await prisma.symbol.findUnique({
      where: { name: symbol as string },
    });

    if (!symbolRecord) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    // Query candles with time range
    const candles = await prisma.oHLCV.findMany({
      where: {
        symbolId: symbolRecord.id,
        timeframe: tf,
        ...(startDate && { time: { gte: startDate } }),
        ...(endDate && { time: { lte: endDate } }),
      },
      orderBy: {
        time: "asc",
      },
      take: limitNum,
    });

    // Transform data to match expected format
    const transformedCandles = candles.map((candle) => ({
      time: Math.floor(candle.time.getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    res.json(transformedCandles);
  } catch (error) {
    console.error("Error fetching candle data:", error);
    res.status(500).json({ error: "Failed to fetch candle data" });
  }
}

/**
 * Store a new candle
 * @route POST /api/candles
 */
export async function storeCandle(req: Request, res: Response): Promise<void> {
  try {
    const {
      symbol,
      open,
      high,
      low,
      close,
      volume,
      timeframe = "1m",
      time,
    } = req.body;

    // Validate inputs
    if (
      !symbol ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined ||
      volume === undefined
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Find or create symbol
    let symbolRecord = await prisma.symbol.findUnique({
      where: { name: symbol },
    });

    if (!symbolRecord) {
      symbolRecord = await prisma.symbol.create({
        data: {
          name: symbol,
          description: `${symbol} trading pair`,
          currentPrice: close,
        },
      });
    } else {
      // Update current price
      await prisma.symbol.update({
        where: { id: symbolRecord.id },
        data: { currentPrice: close },
      });
    }

    // Map timeframe string to enum
    const tf = mapTimeframe(timeframe);

    // Store the candle
    const candle = await prisma.oHLCV.create({
      data: {
        symbolId: symbolRecord.id,
        open,
        high,
        low,
        close,
        volume,
        timeframe: tf,
        time: time ? new Date(time) : new Date(),
      },
    });

    // Implement retention policy - keep only the last 100 candles per symbol/timeframe
    const count = await prisma.oHLCV.count({
      where: {
        symbolId: symbolRecord.id,
        timeframe: tf,
      },
    });

    if (count > 100) {
      // Find the oldest candles to delete
      const oldestCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbolRecord.id,
          timeframe: tf,
        },
        orderBy: {
          time: "asc",
        },
        take: count - 100,
      });

      // Delete oldest candles
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

    res.status(201).json(candle);
  } catch (error) {
    console.error("Error storing candle:", error);
    res.status(500).json({ error: "Failed to store candle" });
  }
}

/**
 * Aggregate candles to a larger timeframe
 * @route GET /api/candles/aggregate
 */
export async function aggregateCandles(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      symbol,
      sourceTimeframe = "1m",
      targetTimeframe,
      limit = "100",
    } = req.query;

    // Validate inputs
    if (!symbol || !targetTimeframe) {
      res
        .status(400)
        .json({ error: "Symbol and targetTimeframe are required" });
      return;
    }

    // Convert limit to number with a maximum of 100
    const limitNum = Math.min(parseInt(limit as string) || 100, 100);

    // Map timeframes
    const sourceTf = mapTimeframe(sourceTimeframe as string);
    const targetTf = mapTimeframe(targetTimeframe as string);

    // Find the symbol ID
    const symbolRecord = await prisma.symbol.findUnique({
      where: { name: symbol as string },
    });

    if (!symbolRecord) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    // For TimescaleDB, we can use the continuous aggregates
    // Check if we can use a pre-computed view
    if (sourceTf === Timeframe.ONE_MINUTE) {
      try {
        // Determine which continuous aggregate view to use
        let viewName = "";
        switch (targetTf) {
          case Timeframe.FIVE_MINUTES:
            viewName = "candles_5m";
            break;
          case Timeframe.FIFTEEN_MINUTES:
            viewName = "candles_15m";
            break;
          case Timeframe.ONE_HOUR:
            viewName = "candles_1h";
            break;
          case Timeframe.ONE_DAY:
            viewName = "candles_1d";
            break;
        }

        if (viewName) {
          // Use the continuous aggregate view
          const result = await prisma.$queryRaw`
            SELECT 
              EXTRACT(EPOCH FROM bucket)::integer as time,
              open,
              high,
              low,
              close,
              volume
            FROM ${Prisma.raw(viewName)}
            WHERE "symbolId" = ${symbolRecord.id}
            ORDER BY bucket DESC
            LIMIT ${limitNum}
          `;

          // Sort by time ascending for chart display
          const typedResult = result as TransformedCandle[];
          typedResult.sort((a, b) => a.time - b.time);

          res.json(typedResult);
          return;
        }
      } catch (error) {
        console.error("Error using continuous aggregate:", error);
        // Fall back to manual aggregation
      }
    }

    // Get source candles
    const sourceCandles = await prisma.oHLCV.findMany({
      where: {
        symbolId: symbolRecord.id,
        timeframe: sourceTf,
      },
      orderBy: {
        time: "asc",
      },
    });

    if (sourceCandles.length === 0) {
      res.json([]);
      return;
    }

    // Determine the aggregation interval in minutes
    let intervalMinutes = 1;
    switch (targetTf) {
      case Timeframe.FIVE_MINUTES:
        intervalMinutes = 5;
        break;
      case Timeframe.TEN_MINUTES:
        intervalMinutes = 10;
        break;
      case Timeframe.FIFTEEN_MINUTES:
        intervalMinutes = 15;
        break;
      case Timeframe.THIRTY_MINUTES:
        intervalMinutes = 30;
        break;
      case Timeframe.ONE_HOUR:
        intervalMinutes = 60;
        break;
      case Timeframe.FOUR_HOURS:
        intervalMinutes = 240;
        break;
      case Timeframe.ONE_DAY:
        intervalMinutes = 1440;
        break;
    }

    // Aggregate candles
    const aggregatedCandles: TransformedCandle[] = [];
    let currentCandle: TransformedCandle | null = null;
    let currentTimestamp = 0;

    sourceCandles.forEach((candle) => {
      const candleTime = candle.time.getTime();
      const intervalMs = intervalMinutes * 60 * 1000;
      const intervalStart = Math.floor(candleTime / intervalMs) * intervalMs;

      if (intervalStart !== currentTimestamp) {
        if (currentCandle) {
          aggregatedCandles.push(currentCandle);
        }

        currentTimestamp = intervalStart;
        currentCandle = {
          time: Math.floor(intervalStart / 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        };
      } else if (currentCandle) {
        // Update the current candle
        currentCandle.high = Math.max(currentCandle.high, candle.high);
        currentCandle.low = Math.min(currentCandle.low, candle.low);
        currentCandle.close = candle.close;
        currentCandle.volume += candle.volume;
      }
    });

    // Add the last candle
    if (currentCandle) {
      aggregatedCandles.push(currentCandle);
    }

    // Return the last 'limit' candles
    const result = aggregatedCandles.slice(-limitNum);

    res.json(result);
  } catch (error) {
    console.error("Error aggregating candles:", error);
    res.status(500).json({ error: "Failed to aggregate candles" });
  }
}

/**
 * Get the latest candle for a symbol
 * @route GET /api/candles/latest
 */
export async function getLatestCandle(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { symbol, timeframe = "1m" } = req.query;

    // Validate inputs
    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Map timeframe string to enum
    const tf = mapTimeframe(timeframe as string);

    // Find the symbol ID
    const symbolRecord = await prisma.symbol.findUnique({
      where: { name: symbol as string },
    });

    if (!symbolRecord) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    // Get the latest candle
    const latestCandle = await prisma.oHLCV.findFirst({
      where: {
        symbolId: symbolRecord.id,
        timeframe: tf,
      },
      orderBy: {
        time: "desc",
      },
    });

    if (!latestCandle) {
      res.status(404).json({ error: "No candle data found" });
      return;
    }

    // Transform data to match expected format
    const transformedCandle: TransformedCandle = {
      time: Math.floor(latestCandle.time.getTime() / 1000),
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
      volume: latestCandle.volume,
    };

    res.json(transformedCandle);
  } catch (error) {
    console.error("Error fetching latest candle:", error);
    res.status(500).json({ error: "Failed to fetch latest candle" });
  }
}
