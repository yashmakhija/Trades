# Timeframe Aggregation System: Technical Overview

## Core Concept: 1-Minute First Approach

Our trading platform employs a "1-minute first" approach for handling candle data across multiple timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d). This means:

1. **Single Data Source**: We only subscribe to 1-minute candles from Binance WebSocket API
2. **Derived Timeframes**: All higher timeframes are dynamically aggregated from the 1-minute data
3. **Consistency**: This ensures data consistency across all timeframes
4. **Reduced API Load**: Minimizes Binance API connections and prevents rate limiting issues

## System Architecture

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Binance API  │──────▶│ BinanceService│──────▶│ CandleService │
└───────────────┘       └───────────────┘       └───────┬───────┘
                                                        │
                                                        ▼
                ┌─────────────────────────────────────────────────┐
                │                                                 │
┌───────────────▼──┐    ┌─────────────┐    ┌────────────────┐    │
│   1m Storage     │    │ Aggregation │    │ Redis Cache    │◀───┘
│   (TimescaleDB)  │───▶│   Engine    │───▶│                │
└──────────────────┘    └──────┬──────┘    └────────┬───────┘
                               │                     │
                               ▼                     ▼
                       ┌───────────────┐     ┌───────────────┐
                       │Higher Timeframe│     │  WebSocket   │
                       │    Storage    │     │   Service    │
                       └───────────────┘     └───────────────┘
                                                     │
                                                     ▼
                                             ┌───────────────┐
                                             │    Clients    │
                                             └───────────────┘
```

## Key Components

### 1. Boundary Detection Mechanism

For each 1-minute candle received, the system checks if it falls on a timeframe boundary:

```typescript
// Check if this candle should trigger an update for higher timeframes
const minute = candleTime.getMinutes();
const hour = candleTime.getHours();

// Check 5-minute boundary
if (minute % 5 === 0) {
  updates.push(
    this.updateTimeframe(symbol, Timeframe.FIVE_MINUTES, candleTime)
  );
}

// Check 15-minute boundary
if (minute % 15 === 0) {
  updates.push(
    this.updateTimeframe(symbol, Timeframe.FIFTEEN_MINUTES, candleTime)
  );
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
```

### 2. Precise Boundary Calculation

One of the most critical aspects is calculating the exact boundary time for each timeframe:

```typescript
// Create a new Date object to avoid modifying the original
const boundaryTime = new Date(endTime);

// Reset to exact boundary (always start with resetting milliseconds and seconds)
boundaryTime.setMilliseconds(0);
boundaryTime.setSeconds(0);

// Adjust time based on timeframe using more precise calculations
switch (timeframe) {
  case Timeframe.FIVE_MINUTES:
    boundaryTime.setMinutes(Math.floor(boundaryTime.getMinutes() / 5) * 5);
    break;
  case Timeframe.FIFTEEN_MINUTES:
    boundaryTime.setMinutes(Math.floor(boundaryTime.getMinutes() / 15) * 15);
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
}
```

### 3. Aggregation Process

For each timeframe update, the system:

1. Calculates exact boundary time
2. Determines appropriate start time based on the timeframe period
3. Fetches all 1-minute candles within that range
4. Performs OHLCV aggregation (open from first, high as max, low as min, close from last, volume as sum)
5. Creates or updates the timeframe candle in the database
6. Updates Redis cache
7. Broadcasts update to connected clients

```typescript
// Aggregate the candles
const open = sourceCandles[0].open;
const high = Math.max(...sourceCandles.map((c) => c.high));
const low = Math.min(...sourceCandles.map((c) => c.low));
const close = sourceCandles[sourceCandles.length - 1].close;
const volume = sourceCandles.reduce((sum, c) => sum + c.volume, 0);
```

### 4. Historical Data Aggregation

For historical requests, we employ a progressive aggregation approach:

1. Check Redis cache first
2. Query the database for native timeframe data
3. If insufficient data, aggregate from smaller timeframes
4. For very high timeframes (1h, 4h, 1d), we may cascade through multiple timeframes:
   - 1d might aggregate from 4h
   - 4h might aggregate from 1h
   - 1h might aggregate from 15m
   - and so on

This ensures complete data even for periods with sparse 1-minute candles.

### 5. UTC Time Consistency

To ensure accurate timeframe boundaries globally, we use UTC time consistently throughout the system:

```typescript
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
```

## Real-time Update Flow

1. **Subscription**: Client subscribes to a specific symbol and timeframe
2. **Initial Data**: System fetches historical data for the requested timeframe
3. **Continuous Updates**: As new 1-minute candles arrive:
   - They are stored in the database
   - The system checks if they fall on timeframe boundaries
   - If yes, higher timeframe candles are aggregated and updated
   - Updates are broadcast to subscribed clients

## Performance Optimizations

1. **Parallel Processing**: Time-critical operations run concurrently:

   ```typescript
   // Run all the timeframe updates in parallel
   await Promise.all(updates);
   ```

2. **Intelligent Caching**: Redis caching with timeframe-specific TTLs:

   ```typescript
   // Cache strategies by timeframe
   private readonly RETENTION_POLICIES = {
     [Timeframe.ONE_MINUTE]: {
       redis: 7 * 24 * 60 * 60,  // 7 days in Redis
       timescale: 30 * 24 * 60 * 60,  // 30 days in TimescaleDB
     },
     [Timeframe.FIFTEEN_MINUTES]: {
       redis: 30 * 24 * 60 * 60,
       timescale: 180 * 24 * 60 * 60,
     },
     // ... other timeframes
   };
   ```

3. **Database Optimization**:

   - Aggregated candles are stored in TimescaleDB for future use
   - Exact compound indexes for symbol + timeframe + time
   - Hypertable partitioning for efficient time-series queries

4. **Partial Aggregation**: For higher timeframes, we allow partial aggregation (min 25% of expected candles):
   ```typescript
   const minimumRequiredCandles = Math.max(
     1,
     Math.ceil(expectedCandleCount * 0.25)
   );
   ```

## Recent Improvements

Our latest fixes and enhancements include:

1. **Fixed 15m/1h/1d Aggregation**: Corrected the boundary calculation logic for all timeframes, ensuring proper aggregation

2. **Improved Source Data Retrieval**: Enhanced the logic for fetching source candles, using proper time windows based on the target timeframe

3. **UTC-based Rounding**: All boundary calculations now consistently use UTC time to avoid time zone issues

4. **Database Persistence**: Aggregated candles are stored in the database, significantly improving performance for future requests

5. **Real-time WebSocket Updates**: Enhanced formatting and delivery of candle updates through WebSocket

6. **Error Resilience**: Added comprehensive error handling and fallback mechanisms for all timeframes

7. **Enhanced Logging**: Added detailed logging to track the aggregation process and identify potential issues

## Result

The system now correctly handles all timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d) with both historical and real-time data. Clients receive consistent data regardless of the requested timeframe, with optimal performance and minimal load on external APIs.
