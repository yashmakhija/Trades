# TimescaleDB Implementation for Trading App

This document explains how TimescaleDB is implemented in the trading application for efficient time-series data storage and retrieval.

## Overview

TimescaleDB is a PostgreSQL extension that optimizes the storage and querying of time-series data. In our trading application, we use TimescaleDB to:

1. Store OHLCV (Open, High, Low, Close, Volume) candle data efficiently
2. Optimize query performance for time-based data
3. Leverage time-series specific functions for data analysis

## Prerequisites

- A PostgreSQL database that supports the TimescaleDB extension
- Neon PostgreSQL supports TimescaleDB on all Postgres versions (Apache 2 license)
- Proper database permissions to create extensions and hypertables

## Apache 2 License Limitations

Neon PostgreSQL provides TimescaleDB with the Apache 2 license, which has some limitations compared to the full TimescaleDB version:

1. **No Continuous Aggregates**: The Apache 2 licensed version does not support continuous aggregates, which are pre-computed materialized views.
2. **No Retention Policies**: Automatic data retention policies are not available.
3. **Limited Compression**: TimescaleDB compression features are not supported.

Despite these limitations, the Apache 2 licensed version still provides significant benefits for time-series data management, including:

1. **Hypertables**: Automatic partitioning of data by time for improved query performance.
2. **Time-Series Functions**: Access to time-series specific functions like `time_bucket`.
3. **Optimized Indexes**: Better index utilization for time-series queries.

## Setup Process

The TimescaleDB setup is designed to be simple and robust:

### Step 1: Check TimescaleDB Availability

First, check if TimescaleDB is available on your database:

```bash
npm run db:check-timescale
```

This script will:

- Test the database connection
- Attempt to enable the TimescaleDB extension
- Report if TimescaleDB is available and its version

If TimescaleDB is not available, you'll need to enable it in your database provider's settings. For Neon PostgreSQL, you can enable it in your project settings.

### Step 2: Set Up TimescaleDB

Once you've confirmed TimescaleDB is available, run the setup script:

```bash
npm run db:timescale
```

This script will:

1. Enable the TimescaleDB extension (if not already enabled)
2. Convert the OHLCV table to a hypertable
3. Create indexes for better query performance

## How It Works

### Hypertables

TimescaleDB uses hypertables to efficiently store time-series data. A hypertable is automatically partitioned by time, which improves query performance and data management.

Our OHLCV table is converted to a hypertable partitioned by the `time` column:

```sql
SELECT create_hypertable('"OHLCV"', 'time');
```

### Time-Series Functions

TimescaleDB provides several useful functions for working with time-series data. One of the most important is `time_bucket`, which allows you to group data into time intervals:

```sql
SELECT
  time_bucket('5 minutes', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE "symbolId" = 'your-symbol-id'
  AND timeframe = 'ONE_MINUTE'
GROUP BY bucket
ORDER BY bucket DESC;
```

## Application-Level Features

Since some TimescaleDB features are not available in the Apache 2 licensed version, we implement these features at the application level:

### Candle Aggregation

We provide an API endpoint for aggregating candles to different timeframes:

```
GET /api/candles/aggregate?symbol=btcusdt&sourceTimeframe=1m&targetTimeframe=5m
```

This endpoint uses SQL queries with the `time_bucket` function to aggregate candles on-demand.

### Data Retention

We implement data retention at the application level by keeping only the last 100 candles per symbol and timeframe. This is handled in the `storeCandle` function in the candle controller.

## Querying Data

### Querying Raw Data

You can query the OHLCV table directly:

```sql
SELECT * FROM "OHLCV"
WHERE "symbolId" = 'your-symbol-id'
  AND timeframe = 'ONE_MINUTE'
  AND time >= NOW() - INTERVAL '1 day'
ORDER BY time DESC;
```

### Aggregating Data

You can use the `time_bucket` function to aggregate data on-demand:

```sql
SELECT
  time_bucket('5 minutes', time) AS bucket,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM "OHLCV"
WHERE "symbolId" = 'your-symbol-id'
  AND timeframe = 'ONE_MINUTE'
  AND time >= NOW() - INTERVAL '1 day'
GROUP BY bucket
ORDER BY bucket DESC;
```

## Troubleshooting

### TimescaleDB Extension Not Available

If you encounter an error indicating that the TimescaleDB extension is not available:

1. Check if your PostgreSQL provider supports TimescaleDB
2. For Neon PostgreSQL, enable the extension in your project settings
3. Verify that you have the necessary permissions to create extensions

### Apache 2 License Errors

If you encounter errors about functionality not being supported under the Apache 2 license:

```
ERROR: functionality not supported under the current "apache" license. Learn more at https://timescale.com/.
```

This means you're trying to use a feature that's only available in the full TimescaleDB version. You'll need to implement this functionality at the application level instead.

## References

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Neon TimescaleDB Extension](https://neon.tech/docs/extensions/timescaledb)
- [PostgreSQL Time-Series Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/hypertables/best-practices/)
