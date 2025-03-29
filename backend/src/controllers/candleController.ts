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
 * Get historical candle data
 * @route GET /api/candles
 */
export async function getCandles(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, timeframe = "1m", limit = "100" } = req.query;
    let { startTime, endTime } = req.query;

    // Validate inputs
    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Convert limit to number with a maximum value
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

    // Parse timeframe
    const timeframeEnum = mapTimeframe(timeframe as string);

    // Log the request for debugging
    console.log(
      `API request for candles: ${symbol}/${timeframe} (limit: ${limitNum})`
    );

    // Parse start and end times if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startTime) {
      // Try parsing as Unix timestamp first (in seconds)
      const timestamp = parseInt(startTime as string);
      if (!isNaN(timestamp)) {
        startDate = new Date(timestamp * 1000); // Convert seconds to milliseconds
      } else {
        // Try as ISO string
        startDate = new Date(startTime as string);
      }
    }

    if (endTime) {
      // Try parsing as Unix timestamp first (in seconds)
      const timestamp = parseInt(endTime as string);
      if (!isNaN(timestamp)) {
        endDate = new Date(timestamp * 1000); // Convert seconds to milliseconds
      } else {
        // Try as ISO string
        endDate = new Date(endTime as string);
      }
    }

    // If no valid date range is provided, use a reasonable default based on timeframe
    if (!startDate) {
      const now = new Date();
      const defaultRanges: Record<string, number> = {
        "1m": 24 * 60 * 60 * 1000, // 1 day for 1m
        "5m": 5 * 24 * 60 * 60 * 1000, // 5 days for 5m
        "10m": 7 * 24 * 60 * 60 * 1000, // 7 days for 10m
        "15m": 7 * 24 * 60 * 60 * 1000, // 7 days for 15m
        "30m": 14 * 24 * 60 * 60 * 1000, // 14 days for 30m
        "1h": 30 * 24 * 60 * 60 * 1000, // 30 days for 1h
        "4h": 60 * 24 * 60 * 60 * 1000, // 60 days for 4h
        "1d": 180 * 24 * 60 * 60 * 1000, // 180 days for 1d
      };

      const defaultRange =
        defaultRanges[timeframe as string] || 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - defaultRange);
    }

    console.log(
      `Fetching ${timeframe} candles for ${symbol} from ${startDate?.toISOString() || "unknown"} to ${endDate?.toISOString() || "now"}`
    );

    // Get candles from service
    const candles = await import("../services/candleService").then((module) =>
      module.default.getCandles(
        symbol as string,
        timeframeEnum,
        limitNum,
        startDate,
        endDate
      )
    );

    if (candles.length === 0 && timeframeEnum !== Timeframe.ONE_MINUTE) {
      console.log(
        `No ${timeframe} candles found, attempting direct aggregation from 1m candles`
      );

      // Try to force aggregate from 1m if available
      const aggregatedCandles = await import("../services/candleService").then(
        (module) =>
          module.default.aggregateCandles(
            symbol as string,
            Timeframe.ONE_MINUTE,
            timeframeEnum,
            limitNum * 2 // Request more candles to ensure we have enough for aggregation
          )
      );

      if (aggregatedCandles && aggregatedCandles.length > 0) {
        console.log(
          `Successfully aggregated ${aggregatedCandles.length} candles for ${timeframe}`
        );

        // Format and return the aggregated candles
        const formattedCandles = aggregatedCandles.map((candle) => ({
          time: Math.floor(candle.time.getTime() / 1000), // Convert to Unix timestamp
          open: candle.open / 100, // Convert to dollars
          high: candle.high / 100,
          low: candle.low / 100,
          close: candle.close / 100,
          volume: candle.volume / 100,
        }));

        res.json(formattedCandles);
        return;
      }

      console.log(`Failed to aggregate ${timeframe} candles from 1m data`);
    }

    // Format candles for API response
    const formattedCandles = candles.map((candle) => ({
      time: Math.floor(candle.time.getTime() / 1000), // Convert to Unix timestamp
      open: candle.open / 100, // Convert to dollars for display
      high: candle.high / 100,
      low: candle.low / 100,
      close: candle.close / 100,
      volume: candle.volume / 100,
    }));

    console.log(
      `Returning ${formattedCandles.length} ${timeframe} candles for ${symbol}`
    );
    res.json(formattedCandles);
  } catch (error) {
    console.error("Error getting candles:", error);
    res.status(500).json({
      error: "Failed to get candles",
      details: error instanceof Error ? error.message : String(error),
    });
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
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

    // Map timeframes
    const sourceTf = mapTimeframe(sourceTimeframe as string);
    const targetTf = mapTimeframe(targetTimeframe as string);

    // Ensure target timeframe is larger than source
    const timeframeToMinutes = {
      [Timeframe.ONE_MINUTE]: 1,
      [Timeframe.FIVE_MINUTES]: 5,
      [Timeframe.TEN_MINUTES]: 10,
      [Timeframe.FIFTEEN_MINUTES]: 15,
      [Timeframe.THIRTY_MINUTES]: 30,
      [Timeframe.ONE_HOUR]: 60,
      [Timeframe.FOUR_HOURS]: 240,
      [Timeframe.ONE_DAY]: 1440,
    };

    if (timeframeToMinutes[targetTf] <= timeframeToMinutes[sourceTf]) {
      res.status(400).json({
        error: "Target timeframe must be larger than source timeframe",
        source: sourceTf,
        target: targetTf,
      });
      return;
    }

    // Find the symbol ID
    const symbolRecord = await prisma.symbol.findUnique({
      where: { name: symbol as string },
    });

    if (!symbolRecord) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    // Use the candleService to aggregate candles
    const aggregatedCandles = await import("../services/candleService").then(
      (module) =>
        module.default.aggregateCandles(
          symbol as string,
          sourceTf,
          targetTf,
          limitNum
        )
    );

    // Transform for API response
    const transformedCandles = aggregatedCandles.map((candle) => ({
      time: Math.floor(candle.time.getTime() / 1000),
      open: candle.open / 100, // Convert to dollars for display
      high: candle.high / 100,
      low: candle.low / 100,
      close: candle.close / 100,
      volume: candle.volume / 100,
    }));

    res.json(transformedCandles);
  } catch (error) {
    console.error("Error aggregating candles:", error);
    res.status(500).json({
      error: "Failed to aggregate candles",
      details: error instanceof Error ? error.message : String(error),
    });
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

    // Use the candle service to get the latest candle
    const latestCandle = await import("../services/candleService").then(
      (module) => module.default.getLatestCandle(symbol as string, tf)
    );

    if (!latestCandle) {
      // If no candle found for the requested timeframe, try to aggregate from 1m
      if (tf !== Timeframe.ONE_MINUTE) {
        console.log(`No ${tf} candle found, trying to aggregate from 1m data`);

        const aggregated = await import("../services/candleService").then(
          (module) =>
            module.default.aggregateCandles(
              symbol as string,
              Timeframe.ONE_MINUTE,
              tf,
              1
            )
        );

        if (aggregated && aggregated.length > 0) {
          // Return the aggregated candle
          const transformedCandle: TransformedCandle = {
            time: Math.floor(aggregated[0].time.getTime() / 1000),
            open: aggregated[0].open / 100, // Convert to dollars for display
            high: aggregated[0].high / 100,
            low: aggregated[0].low / 100,
            close: aggregated[0].close / 100,
            volume: aggregated[0].volume / 100,
          };

          res.json(transformedCandle);
          return;
        }
      }

      res.status(404).json({ error: "No candle data found" });
      return;
    }

    // Transform data to match expected format
    const transformedCandle: TransformedCandle = {
      time: Math.floor(latestCandle.time.getTime() / 1000),
      open: latestCandle.open / 100, // Convert to dollars for display
      high: latestCandle.high / 100,
      low: latestCandle.low / 100,
      close: latestCandle.close / 100,
      volume: latestCandle.volume / 100,
    };

    res.json(transformedCandle);
  } catch (error) {
    console.error("Error fetching latest candle:", error);
    res.status(500).json({
      error: "Failed to fetch latest candle",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
