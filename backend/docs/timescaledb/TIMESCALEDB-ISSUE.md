# TimescaleDB Implementation Update

## TimescaleDB on Neon PostgreSQL: Apache 2 License Limitations

After investigating the TimescaleDB setup for the trading application, we've confirmed that Neon PostgreSQL does support the TimescaleDB extension. However, it's important to note that Neon provides TimescaleDB with the Apache 2 license, which has some limitations compared to the full version.

### What Works

✅ **Basic TimescaleDB Features**:

- Enabling the TimescaleDB extension
- Converting tables to hypertables for time-series optimization
- Using time-series functions like `time_bucket` for aggregation
- Creating indexes optimized for time-series data

### What Doesn't Work

❌ **Advanced TimescaleDB Features**:

- Continuous aggregates (materialized views)
- Automatic retention policies
- Compression features
- Some other enterprise features

When attempting to use these advanced features, you'll encounter an error like:

```
ERROR: functionality not supported under the current "apache" license. Learn more at https://timescale.com/.
HINT: To access all features and the best time-series experience, try out Timescale Cloud.
```

## Our Solution

We've implemented a hybrid approach that leverages the available TimescaleDB features while implementing the missing functionality at the application level:

1. **Hypertable Conversion**: We convert the OHLCV table to a TimescaleDB hypertable for optimized time-series storage and querying.

2. **Application-Level Aggregation**: Instead of continuous aggregates, we use the `time_bucket` function to aggregate data on-demand through our API.

3. **Application-Level Retention**: We implement data retention in our controller code, keeping only the last 100 candles per symbol and timeframe.

## Implementation Changes

We've made the following changes to properly implement TimescaleDB with the Apache 2 license:

1. **Simplified Setup Process**: We've created a streamlined setup process that focuses on the available features:

   - Check if TimescaleDB is available on your database
   - Set up the hypertable and indexes for the OHLCV table

2. **Improved Error Handling**: The setup scripts now detect and handle Apache 2 license limitations gracefully, providing clear error messages and guidance.

3. **No Manual Schema Changes**: The implementation works with the existing Prisma schema without requiring manual SQL modifications.

4. **Updated Documentation**: Created detailed documentation that explains the limitations and how we work around them.

## How to Use

1. **Check TimescaleDB Availability**:

   ```bash
   npm run db:check-timescale
   ```

   This will verify if TimescaleDB is available on your database.

2. **Set Up TimescaleDB**:

   ```bash
   npm run db:timescale
   ```

   This will set up the basic TimescaleDB features for the OHLCV table.

3. **Test the Implementation**:
   ```bash
   npm run test:candles
   ```
   This will test the TimescaleDB implementation with sample data.

## Next Steps

1. **Run the Check Script**: Execute `npm run db:check-timescale` to verify that TimescaleDB is available on your database.

2. **Set Up TimescaleDB**: If TimescaleDB is available, run `npm run db:timescale` to set it up for the OHLCV table.

3. **Consider Alternatives**: If you need the advanced features, consider:
   - Using a self-hosted PostgreSQL instance with the full TimescaleDB version
   - Subscribing to Timescale Cloud for a managed solution with all features
   - Using a different time-series database like InfluxDB or QuestDB

## References

- [Neon TimescaleDB Documentation](https://neon.tech/docs/extensions/timescaledb)
- [TimescaleDB License Information](https://docs.timescale.com/timescaledb/latest/how-to-guides/install-timescaledb/installation-linux/#license)
- [TIMESCALEDB-SETUP.md](./TIMESCALEDB-SETUP.md) - Our detailed implementation guide
