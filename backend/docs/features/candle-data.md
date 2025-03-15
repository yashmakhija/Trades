# Candle Data Management System

This document describes the candle data management system implemented for the trading platform, which uses TimescaleDB for efficient time-series data storage.

## Overview

The candle data management system provides:

- Storage of 1-minute candles as the base data
- Automatic aggregation to larger timeframes (5m, 15m, 1h, 1d)
- Retention policy to keep only the last 100 candles per symbol/timeframe
- Real-time updates via WebSocket
- REST API endpoints for historical data retrieval

## Technical Architecture

### Database Schema

The system uses TimescaleDB (an extension of PostgreSQL) with the following schema:

```prisma
model OHLCV {
  id        String     @id @default(uuid())
  symbolId  String
  symbol    Symbol     @relation(fields: [symbolId], references: [id])
  open      Int
  high      Int
  low       Int
  close     Int
  volume    Int
  timeframe Timeframe  @default(ONE_MINUTE)
  time      DateTime   @default(now())

  @@index([symbolId, timeframe, time(sort: Desc)])
  @@index([time(sort: Desc)])
  @@index([symbolId])
  @@index([timeframe])
}

enum Timeframe {
  ONE_MINUTE
  FIVE_MINUTES
  TEN_MINUTES
  FIFTEEN_MINUTES
  THIRTY_MINUTES
  ONE_HOUR
  FOUR_HOURS
  ONE_DAY
}
```

### TimescaleDB Features

The system leverages TimescaleDB's specialized features:

1. **Hypertables**: The OHLCV table is converted to a hypertable partitioned by time for efficient time-series queries.
2. **Continuous Aggregates**: Pre-computed views for larger timeframes (5m, 15m, 1h, 1d) to optimize query performance.
3. **Retention Policies**: Automatically removes data older than 7 days for 1-minute candles.
4. **Compression**: Older data is automatically compressed to reduce storage requirements.

### API Endpoints

#### GET /api/candles

Retrieves historical candle data for a specific symbol and timeframe.

**Parameters:**

- `symbol` (required): Symbol name (e.g., btcusdt)
- `timeframe` (optional): Candle timeframe (1m, 5m, 15m, etc.), defaults to 1m
- `limit` (optional): Maximum number of candles to return (max 100), defaults to 100

**Response:**

```json
[
  {
    "time": 1647352800,
    "open": 45000,
    "high": 45500,
    "low": 44800,
    "close": 45200,
    "volume": 1000
  },
  ...
]
```

#### POST /api/candles

Stores a new candle for a specific symbol.

**Request Body:**

```json
{
  "symbol": "btcusdt",
  "open": 45000,
  "high": 45500,
  "low": 44800,
  "close": 45200,
  "volume": 1000,
  "timeframe": "1m",
  "time": "2023-04-01T12:00:00.000Z" // Optional, defaults to current time
}
```

**Response:**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "symbolId": "abc123",
  "open": 45000,
  "high": 45500,
  "low": 44800,
  "close": 45200,
  "volume": 1000,
  "timeframe": "ONE_MINUTE",
  "time": "2023-04-01T12:00:00.000Z"
}
```

#### GET /api/candles/aggregate

Aggregates candles from a source timeframe to a target timeframe.

**Parameters:**

- `symbol` (required): Symbol name (e.g., btcusdt)
- `sourceTimeframe` (optional): Source candle timeframe, defaults to 1m
- `targetTimeframe` (required): Target candle timeframe
- `limit` (optional): Maximum number of candles to return (max 100), defaults to 100

**Response:**

```json
[
  {
    "time": 1647352800,
    "open": 45000,
    "high": 45500,
    "low": 44800,
    "close": 45200,
    "volume": 5000
  },
  ...
]
```

#### GET /api/candles/latest

Returns the latest candle for a specific symbol and timeframe.

**Parameters:**

- `symbol` (required): Symbol name (e.g., btcusdt)
- `timeframe` (optional): Candle timeframe, defaults to 1m

**Response:**

```json
{
  "time": 1647352800,
  "open": 45000,
  "high": 45500,
  "low": 44800,
  "close": 45200,
  "volume": 1000
}
```

### WebSocket Communication

The system uses WebSocket for real-time candle updates:

#### Subscribe to Candles

```json
{
  "type": "SUBSCRIBE_CANDLES",
  "symbol": "btcusdt",
  "timeframe": "1m"
}
```

#### Candle History Response

```json
{
  "type": "CANDLE_HISTORY",
  "symbol": "btcusdt",
  "timeframe": "1m",
  "data": [
    {
      "time": 1647352800,
      "open": 45000,
      "high": 45500,
      "low": 44800,
      "close": 45200,
      "volume": 1000
    },
    ...
  ]
}
```

#### Candle Update

```json
{
  "type": "CANDLE_UPDATE",
  "data": {
    "symbol": "btcusdt",
    "timeframe": "1m",
    "candle": {
      "time": 1647352800,
      "open": 45000,
      "high": 45500,
      "low": 44800,
      "close": 45200,
      "volume": 1000
    }
  }
}
```

## Implementation Details

### Retention Policy

The system implements a retention policy to keep only the last 100 candles per symbol/timeframe combination. This is done at the application level when storing new candles:

1. When a new candle is stored, the system counts the existing candles for that symbol/timeframe.
2. If the count exceeds 100, the oldest candles are deleted to maintain the limit.

Additionally, TimescaleDB's built-in retention policy is configured to automatically remove 1-minute candle data older than 7 days.

### Continuous Aggregates

TimescaleDB continuous aggregates are used to pre-compute and maintain aggregated views of the data:

- 5-minute candles (`candles_5m`)
- 15-minute candles (`candles_15m`)
- 1-hour candles (`candles_1h`)
- 1-day candles (`candles_1d`)

These views are automatically refreshed according to the configured schedule intervals.

### Fallback Aggregation

If continuous aggregates are not available (e.g., for custom timeframes or during initial setup), the system falls back to manual aggregation:

1. Retrieve source candles (e.g., 1-minute candles)
2. Group them by the target timeframe interval
3. Aggregate the OHLCV values within each group
4. Return the aggregated results

## Setup and Configuration

### Database Setup

1. Install TimescaleDB extension for PostgreSQL
2. Run the Prisma migration:
   ```
   npx prisma migrate dev --name add_timeframe_to_ohlcv
   ```
3. Run the TimescaleDB setup script:
   ```
   node scripts/setup-timescaledb.js
   ```

### Environment Variables

Add the following environment variables to your `.env` file:

```
# TimescaleDB retention policy (in days)
TIMESCALE_RETENTION_DAYS=7

# Maximum number of candles to keep per symbol/timeframe
MAX_CANDLES_PER_SYMBOL=100
```

## Best Practices

1. **Store 1-minute candles as base data**: This provides maximum precision and flexibility.
2. **Use TimescaleDB continuous aggregates**: For efficient aggregation to larger timeframes.
3. **Implement retention policies**: To manage storage growth.
4. **Use integers for price data**: To avoid floating-point precision issues.
5. **Batch inserts when possible**: For better performance.
6. **Use WebSocket for real-time updates**: To minimize latency.
7. **Implement proper error handling**: For robustness.

## Troubleshooting

### Common Issues

1. **Missing TimescaleDB extension**: Ensure the extension is installed and enabled in your PostgreSQL database.
2. **Continuous aggregates not updating**: Check the refresh policies and ensure they are properly configured.
3. **Performance issues with large datasets**: Consider adjusting the chunk time interval for the hypertable.
4. **Data inconsistency**: Verify that the retention policy is working correctly and not deleting data unexpectedly.

### Monitoring

Monitor the following metrics to ensure the system is functioning properly:

- Database size growth
- Query performance
- Continuous aggregate refresh times
- WebSocket message throughput

## Future Improvements

1. **Implement data compression**: Configure TimescaleDB to compress older data for better storage efficiency.
2. **Add caching layer**: Implement Redis caching for frequently accessed candle data.
3. **Optimize batch inserts**: Implement bulk insertion for better performance during high-volume periods.
4. **Add data validation**: Implement more robust validation for incoming candle data.
5. **Enhance error handling**: Add more detailed error reporting and recovery mechanisms.
