# Timeframe Aggregation Implementation Guide

## Overview

This document explains the technical implementation of our "1-minute first" approach for handling candle data across multiple timeframes. This design treats 1-minute candles as the fundamental data unit from which all other timeframes (5m, 15m, 30m, 1h, 4h, 1d) are derived through real-time and historical aggregation.

## Core Components

### 1. Binance WebSocket Subscription

We subscribe only to 1-minute candles from Binance, rather than connecting to multiple timeframe streams:

```typescript
function subscribeToStreams(ws: WebSocket): void {
  const symbols = config.tradingSymbols.split(",");

  // Only subscribe to 1m klines from Binance - we'll derive other timeframes
  const klineSubscriptionMsg: BinanceSubscriptionMessage = {
    method: "SUBSCRIBE",
    params: symbols.map((symbol) => `${symbol}@kline_1m`),
    id: 2,
  };

  // Send subscription messages
  ws.send(JSON.stringify(klineSubscriptionMsg));
  console.log(`Subscribed to 1m klines: ${symbols.join(", ")}`);
}
```

### 2. Real-time Aggregation Process

When a new 1-minute candle arrives, we process it through the following pipeline:

1. Store the 1-minute candle in TimescaleDB
2. Update Redis cache for 1-minute timeframe
3. Check if this candle is on a timeframe boundary (5m, 15m, etc.)
4. If it is, trigger aggregation for the relevant higher timeframes

This is handled by our `broadcastCandleUpdate` function which calls `updateHigherTimeframes` when appropriate:

```typescript
private broadcastCandleUpdate(symbol: string, timeframe: Timeframe, candle: OHLCV) {
  // Broadcast code...

  // When we receive a new 1-minute candle, also update higher timeframes
  if (timeframe === Timeframe.ONE_MINUTE) {
    this.updateHigherTimeframes(symbol, candle);
  }
}
```

### 3. Timeframe Boundary Detection

The system detects timeframe boundaries by examining the timestamp of each 1-minute candle:

```typescript
private async updateHigherTimeframes(symbol: string, candle: OHLCV) {
  // Get current time
  const candleTime = candle.time;
  const minute = candleTime.getMinutes();
  const hour = candleTime.getHours();

  console.log(`Checking timeframe updates for ${symbol} at ${candleTime.toISOString()}`);

  // Update all timeframes as needed
  const updates = [];

  // Check 5-minute boundary
  if (minute % 5 === 0) {
    updates.push(this.updateTimeframe(symbol, Timeframe.FIVE_MINUTES, candleTime));
  }

  // Check 15-minute boundary
  if (minute % 15 === 0) {
    updates.push(this.updateTimeframe(symbol, Timeframe.FIFTEEN_MINUTES, candleTime));
  }

  // Check hourly boundary
  if (minute === 0) {
    updates.push(this.updateTimeframe(symbol, Timeframe.ONE_HOUR, candleTime));
  }

  // Check 4-hour boundary
  if (minute === 0 && hour % 4 === 0) {
    updates.push(this.updateTimeframe(symbol, Timeframe.FOUR_HOURS, candleTime));
  }

  // Check daily boundary
  if (minute === 0 && hour === 0) {
    updates.push(this.updateTimeframe(symbol, Timeframe.ONE_DAY, candleTime));
  }

  // Run all the timeframe updates in parallel
  await Promise.all(updates);
}
```

### 4. Aggregation Logic

For each timeframe update, we:

1. Calculate the exact window boundaries
2. Fetch all 1-minute candles within that window
3. Aggregate them into a single higher timeframe candle
4. Store or update the result in the database
5. Update the Redis cache
6. Broadcast the update to clients

```typescript
private async updateTimeframe(symbol: string, timeframe: Timeframe, endTime: Date) {
  // Get the symbol record
  const symbolRecord = await prisma.symbol.findUnique({
    where: { name: symbol },
  });

  if (!symbolRecord) {
    console.error(`Symbol ${symbol} not found`);
    return;
  }

  // Calculate boundary time (e.g., exactly 00:05:00 for 5m candle)
  const boundaryTime = calculateBoundaryTime(endTime, timeframe);

  // Calculate start time for data window
  const startTime = calculateStartTime(boundaryTime, timeframe);

  console.log(`Updating ${timeframe} for ${symbol}: ${startTime.toISOString()} to ${boundaryTime.toISOString()}`);

  // Get all 1-minute candles in this timeframe period
  const sourceCandles = await prisma.oHLCV.findMany({
    where: {
      symbolId: symbolRecord.id,
      timeframe: Timeframe.ONE_MINUTE,
      time: {
        gte: startTime,
        lt: boundaryTime,
      }
    },
    orderBy: {
      time: "asc",
    },
  });

  if (sourceCandles.length === 0) {
    console.log(`No source candles found for ${symbol} ${timeframe}`);
    return;
  }

  // Aggregate the candles
  const open = sourceCandles[0].open;
  const high = Math.max(...sourceCandles.map(c => c.high));
  const low = Math.min(...sourceCandles.map(c => c.low));
  const close = sourceCandles[sourceCandles.length - 1].close;
  const volume = sourceCandles.reduce((sum, c) => sum + c.volume, 0);

  // Save the aggregated candle and broadcast updates
  // ...
}
```

### 5. Historical Data Retrieval

Our historical data retrieval process has multiple steps:

```typescript
async getCandles(symbol, timeframe, limit, startTime, endTime) {
  // Try Redis cache first
  const cachedCandles = await redisService.getCachedCandles(...);
  if (cachedCandles && cachedCandles.length > 0) {
    return formatCachedCandles(cachedCandles);
  }

  // If cache miss, query the database for this timeframe
  let dbCandles = await prisma.oHLCV.findMany({
    where: {
      symbolId,
      timeframe,
      // time filters
    },
    // ...
  });

  // If we don't have enough data, try aggregating from smaller timeframes
  if (dbCandles.length < limit && timeframe !== Timeframe.ONE_MINUTE) {
    const sourceTimeframe = getNextSmallerTimeframe(timeframe);
    const aggregatedCandles = await aggregateCandles(
      symbol,
      sourceTimeframe,
      timeframe,
      limit * getTimeframeRatio(sourceTimeframe, timeframe)
    );

    // Merge results, removing duplicates
    mergeCandles(dbCandles, aggregatedCandles);
  }

  // Cache and return results
  await cacheCandles(dbCandles);
  return dbCandles;
}
```

## Key Technical Details

### 1. Calculating Timeframe Boundaries

Precise boundary calculation is critical for accurate aggregation:

```typescript
// Example of calculating a boundary time for 5-minute candles
if (timeframe === Timeframe.FIVE_MINUTES) {
  boundaryTime.setMilliseconds(0);
  boundaryTime.setSeconds(0);
  boundaryTime.setMinutes(Math.floor(boundaryTime.getMinutes() / 5) * 5);
}
```

### 2. Timeframe Ratio Calculation

To determine how many smaller timeframe candles are needed to form a larger timeframe:

```typescript
private getTimeframeRatio(smaller: Timeframe, larger: Timeframe): number {
  const timeframeToMinutes: Record<Timeframe, number> = {
    [Timeframe.ONE_MINUTE]: 1,
    [Timeframe.FIVE_MINUTES]: 5,
    [Timeframe.FIFTEEN_MINUTES]: 15,
    [Timeframe.THIRTY_MINUTES]: 30,
    [Timeframe.ONE_HOUR]: 60,
    [Timeframe.FOUR_HOURS]: 240,
    [Timeframe.ONE_DAY]: 1440,
  };

  return timeframeToMinutes[larger] / timeframeToMinutes[smaller];
}
```

### 3. Finding the Next Smaller Timeframe

For progressive aggregation when data is missing:

```typescript
private getNextSmallerTimeframe(timeframe: Timeframe): Timeframe {
  switch (timeframe) {
    case Timeframe.ONE_DAY:
      return Timeframe.FOUR_HOURS;
    case Timeframe.FOUR_HOURS:
      return Timeframe.ONE_HOUR;
    case Timeframe.ONE_HOUR:
      return Timeframe.THIRTY_MINUTES;
    // ... and so on
    default:
      return Timeframe.ONE_MINUTE;
  }
}
```

### 4. WebSocket Client Communication

We format all candle data consistently for the client, regardless of the source timeframe:

```typescript
// Format the candle data for client consumption
const formattedCandles = candles.map((candle) => ({
  time: Math.floor(candle.time.getTime() / 1000), // Unix timestamp in seconds
  open: candle.open / 100, // Convert from cents to dollars
  high: candle.high / 100,
  low: candle.low / 100,
  close: candle.close / 100,
  volume: candle.volume / 100,
}));

client.ws.send(
  JSON.stringify({
    type: "CANDLE_HISTORY",
    symbol,
    timeframe,
    data: formattedCandles,
  })
);
```

## Performance Considerations

### 1. Parallel Processing

We use `Promise.all()` to run aggregation tasks concurrently:

```typescript
// Run all the timeframe updates in parallel
await Promise.all(updates);
```

### 2. Intelligent Caching

We cache data based on timeframe-specific retention policies:

```typescript
const CACHE_STRATEGIES: Record<Timeframe, CacheStrategy> = {
  [Timeframe.ONE_MINUTE]: {
    cacheTTL: 60, // Cache for 1 minute
    maxCachedCandles: 1000, // Keep up to 1000 candles
  },
  [Timeframe.FIVE_MINUTES]: {
    cacheTTL: 300,
    maxCachedCandles: 800,
  },
  // ... and so on
};
```

### 3. Database Query Optimization

We use specific indexes for efficient time-series data retrieval:

```sql
-- Compound index for efficient time-series queries
CREATE INDEX idx_ohlcv_symbol_timeframe_time ON ohlcv (symbol_id, timeframe, time DESC);
```

## Edge Cases Handling

### 1. Missing Data

If source data is missing, we try to reconstruct it from even smaller timeframes or handle the gap appropriately.

### 2. Invalid Boundaries

We handle time zone changes and DST correctly through proper UTC date calculations.

### 3. Duplicate Candles

We use a Map with time keys to detect and filter out duplicate candles when merging data sources.

## Conclusion

Our 1-minute first approach creates a robust, efficient system for handling candle data across multiple timeframes. By treating 1-minute candles as the fundamental data unit, we ensure consistency across all timeframes while maintaining performance and reliability.
