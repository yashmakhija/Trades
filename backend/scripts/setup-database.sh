#!/bin/bash

# This script sets up the database for the trading app
# It runs the Prisma migration and sets up TimescaleDB

echo "Setting up database for trading app..."

# Run Prisma migration
echo "Running Prisma migration..."
npx prisma migrate dev --name add_timeframe_to_ohlcv

# Run TimescaleDB setup
echo "Setting up TimescaleDB..."
node scripts/setup-timescaledb.js

echo "Database setup complete!" 