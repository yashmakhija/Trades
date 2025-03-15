# TimescaleDB Scripts

This directory contains scripts for setting up and testing TimescaleDB in the trading application.

## Overview

The scripts in this directory are used to:

1. Check if TimescaleDB is available on your database
2. Set up TimescaleDB for the OHLCV table
3. Test the TimescaleDB implementation

## Usage

You can use these scripts through the npm scripts defined in package.json:

```bash
# Check if TimescaleDB is available
npm run db:check-timescale

# Set up TimescaleDB for the OHLCV table
npm run db:timescale

# Test the TimescaleDB implementation
npm run test:candles
```

Or you can run the index.js script directly:

```bash
# Check if TimescaleDB is available
node scripts/timescaledb/index.js check

# Set up TimescaleDB for the OHLCV table
node scripts/timescaledb/index.js setup

# Test the TimescaleDB implementation
node scripts/timescaledb/index.js test

# Show help
node scripts/timescaledb/index.js help
```

## Script Files

- **index.js**: Main entry point for the TimescaleDB scripts
- **check-timescaledb.js**: Checks if TimescaleDB is available on your database
- **setup-timescaledb.js**: Sets up TimescaleDB for the OHLCV table
- **test-candle-data.js**: Tests the TimescaleDB implementation
- **apply-timescale-schema-fix.js**: Applies schema fixes for TimescaleDB compatibility (if needed)
- **setup-timescale-aggregates.js**: Sets up continuous aggregates (not available in Apache 2 license)

## Documentation

For more detailed information about the TimescaleDB implementation, please refer to the documentation in the `docs/timescaledb` directory.
