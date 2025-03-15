# TimescaleDB Implementation for Trading App

This directory contains comprehensive documentation about the TimescaleDB implementation in the Trading App backend.

## Overview

TimescaleDB is used in this project to efficiently store and query time-series data, specifically OHLCV (Open, High, Low, Close, Volume) candle data for trading pairs. The implementation provides:

- Optimized storage for 1-minute candles
- Automatic aggregation to larger timeframes (5m, 15m, 1h, 1d)
- Efficient querying with hypertables and continuous aggregates
- Retention policies for managing data lifecycle

## Documentation Files

- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - Comprehensive overview of the TimescaleDB implementation
- [Setup Guide](./TIMESCALEDB-SETUP.md) - Detailed instructions for setting up TimescaleDB
- [Issue Troubleshooting](./TIMESCALEDB-ISSUE.md) - Common issues and their solutions
- [Final Implementation](./TIMESCALEDB-FINAL.md) - Final implementation details and architecture
- [Summary](./SUMMARY.md) - Brief summary of the TimescaleDB implementation

## Quick Start

1. Ensure TimescaleDB extension is installed in your PostgreSQL database
2. Run the setup script:
   ```
   npm run db:timescale
   # or
   bun run db:timescale
   ```
3. Verify the setup:
   ```
   npm run db:timescale:test
   # or
   bun run db:timescale:test
   ```

## Database Schema

The OHLCV model in the Prisma schema is configured to work with TimescaleDB:

```prisma
model OHLCV {
  id        String    @id @default(uuid())
  symbol    Symbol    @relation(fields: [symbolId], references: [id])
  symbolId  String
  timestamp DateTime
  timeframe Timeframe
  open      Float
  high      Float
  low       Float
  close     Float
  volume    Float

  @@unique([symbolId, timestamp, timeframe])
  @@index([symbolId, timeframe, timestamp(sort: Desc)])
  @@index([timestamp])
}

enum Timeframe {
  ONE_MINUTE
  FIVE_MINUTES
  FIFTEEN_MINUTES
  ONE_HOUR
  FOUR_HOURS
  ONE_DAY
}
```

## TimescaleDB Features Used

- **Hypertables**: The OHLCV table is converted to a hypertable partitioned by time
- **Continuous Aggregates**: Pre-computed aggregates for different timeframes
- **Retention Policies**: Automatic data cleanup based on age
- **Compression**: (Optional) Data compression for older chunks

## API Integration

The TimescaleDB implementation is integrated with the API through the following endpoints:

- `GET /api/candles` - Get historical candle data
- `POST /api/candles` - Store a new candle
- `GET /api/candles/aggregate` - Aggregate candles to a larger timeframe
- `GET /api/candles/latest` - Get the latest candle for a symbol

For more details on the API, see the [API Documentation](../api/README.md).

## Performance Considerations

- Queries are optimized with appropriate indexes
- Continuous aggregates reduce query time for larger timeframes
- Retention policies prevent database bloat
- Compression can be enabled for older data to reduce storage requirements

## Related Documentation

- [Candle Data System](../features/candle-data.md) - Overview of the candle data management system
- [TimescaleDB Official Documentation](https://docs.timescale.com/)
