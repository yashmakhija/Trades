import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Timeframe } from "@prisma/client";
import {
  mapTimeframe,
  getDefaultTimeRange,
  formatCandleData,
  TIMEFRAME_MINUTES,
} from "../utils/timeframe";
import { candleService } from "../services/candleService";

/**
 * Get historical candle data with pagination support
 * @route GET /api/candles
 */
export async function getCandles(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, timeframe = "1m", limit = "100", page = "0" } = req.query;
    let { startTime, endTime } = req.query;

    // Validate inputs
    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Convert limit to number with a maximum value
    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);
    const pageNum = Math.max(parseInt(page as string) || 0, 0);

    // Parse timeframe
    const timeframeEnum = mapTimeframe(timeframe as string);

    // Log the request for debugging
    console.log(
      `API request for candles: ${symbol}/${timeframe} (limit: ${limitNum}, page: ${pageNum})`
    );

    // Parse start and end times if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startTime) {
      const timestamp = parseInt(startTime as string);
      if (!isNaN(timestamp)) {
        startDate = new Date(timestamp * 1000);
      } else {
        startDate = new Date(startTime as string);
      }
    }

    if (endTime) {
      const timestamp = parseInt(endTime as string);
      if (!isNaN(timestamp)) {
        endDate = new Date(timestamp * 1000);
      } else {
        endDate = new Date(endTime as string);
      }
    }

    // If no valid date range is provided, use a reasonable default based on timeframe
    if (!startDate && pageNum === 0) {
      const now = new Date();
      const defaultRange = getDefaultTimeRange(timeframe as string);
      startDate = new Date(now.getTime() - defaultRange);
    }

    console.log(
      `Fetching ${timeframe} candles for ${symbol} from ${startDate?.toISOString() || "all time"} to ${endDate?.toISOString() || "now"} (page ${pageNum})`
    );

    // Get candles from service with pagination
    const candles = await candleService.getCandles(
      symbol as string,
      timeframeEnum,
      limitNum,
      startDate,
      endDate,
      pageNum
    );

    // For the first page with no data, try direct aggregation from smaller timeframe
    if (
      candles.length === 0 &&
      timeframeEnum !== Timeframe.ONE_MINUTE &&
      pageNum === 0
    ) {
      console.log(
        `No ${timeframe} candles found, attempting direct aggregation from 1m candles`
      );

      // Try to force aggregate from 1m if available
      const aggregatedCandles = await candleService.aggregateCandles(
        symbol as string,
        Timeframe.ONE_MINUTE,
        timeframeEnum,
        limitNum * 2,
        startDate,
        endDate
      );

      if (aggregatedCandles && aggregatedCandles.length > 0) {
        console.log(
          `Successfully aggregated ${aggregatedCandles.length} candles for ${timeframe}`
        );

        // Format and return the aggregated candles
        const formattedCandles = aggregatedCandles.map(formatCandleData);

        // Add pagination metadata
        const response = {
          candles: formattedCandles,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount: formattedCandles.length,
            hasMore: false,
          },
        };

        res.json(response);
        return;
      }

      console.log(`Failed to aggregate ${timeframe} candles from 1m data`);
    }

    // Format candles for API response
    const formattedCandles = candles.map(formatCandleData);

    // Get total count for pagination if this is the first page
    let totalCount = 0;
    let hasMore = false;

    if (pageNum === 0 || formattedCandles.length === limitNum) {
      totalCount = await candleService.getCandleCount(
        symbol as string,
        timeframeEnum,
        startDate,
        endDate
      );

      hasMore = (pageNum + 1) * limitNum < totalCount;
    } else {
      // If we got fewer results than the limit, we've reached the end
      hasMore = false;
      totalCount = pageNum * limitNum + formattedCandles.length;
    }

    console.log(
      `Returning ${formattedCandles.length} ${timeframe} candles for ${symbol} (page ${pageNum}, total: ${totalCount})`
    );

    // Add pagination metadata to response
    const response = {
      candles: formattedCandles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        hasMore,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting candles:", error);
    res.status(500).json({
      error: "Failed to get candles",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get count of available candles for pagination
 * @route GET /api/candles/count
 */
export async function getCandlesCount(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { symbol, timeframe = "1m" } = req.query;
    let { startTime, endTime } = req.query;

    // Validate inputs
    if (!symbol) {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }

    // Parse timeframe
    const timeframeEnum = mapTimeframe(timeframe as string);

    // Parse start and end times if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startTime) {
      const timestamp = parseInt(startTime as string);
      if (!isNaN(timestamp)) {
        startDate = new Date(timestamp * 1000);
      } else {
        startDate = new Date(startTime as string);
      }
    }

    if (endTime) {
      const timestamp = parseInt(endTime as string);
      if (!isNaN(timestamp)) {
        endDate = new Date(timestamp * 1000);
      } else {
        endDate = new Date(endTime as string);
      }
    }

    // Get count from service
    const count = await candleService.getCandleCount(
      symbol as string,
      timeframeEnum,
      startDate,
      endDate
    );

    res.json({ count });
  } catch (error) {
    console.error("Error getting candle count:", error);
    res.status(500).json({
      error: "Failed to get candle count",
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

    // Store the candle using CandleService
    const candle = await candleService.storeCandle(
      symbol,
      open,
      high,
      low,
      close,
      volume,
      tf,
      time ? new Date(time) : new Date()
    );

    res.status(201).json(formatCandleData(candle));
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
    if (TIMEFRAME_MINUTES[targetTf] <= TIMEFRAME_MINUTES[sourceTf]) {
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
    const aggregatedCandles = await candleService.aggregateCandles(
      symbol as string,
      sourceTf,
      targetTf,
      limitNum
    );

    // Transform for API response
    const transformedCandles = aggregatedCandles.map(formatCandleData);

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
    const latestCandle = await candleService.getLatestCandle(
      symbol as string,
      tf
    );

    if (!latestCandle) {
      // If no candle found for the requested timeframe, try to aggregate from 1m
      if (tf !== Timeframe.ONE_MINUTE) {
        console.log(`No ${tf} candle found, trying to aggregate from 1m data`);

        const aggregated = await candleService.aggregateCandles(
          symbol as string,
          Timeframe.ONE_MINUTE,
          tf,
          1
        );

        if (aggregated && aggregated.length > 0) {
          // Return the aggregated candle
          res.json(formatCandleData(aggregated[0]));
          return;
        }
      }

      res.status(404).json({ error: "No candle data found" });
      return;
    }

    // Transform data to match expected format
    res.json(formatCandleData(latestCandle));
  } catch (error) {
    console.error("Error fetching latest candle:", error);
    res.status(500).json({
      error: "Failed to fetch latest candle",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
