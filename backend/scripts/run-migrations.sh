#!/bin/bash
set -e

echo "Running database migrations..."

# Wait for database to be ready
max_retries=30
counter=0
until pg_isready -h timescaledb -U postgres; do
  counter=$((counter + 1))
  if [ $counter -gt $max_retries ]; then
    echo "Database connection failed after $max_retries attempts. Exiting."
    exit 1
  fi
  echo "Database not ready yet. Retrying in 2 seconds..."
  sleep 2
done

echo "Database is ready, checking existing tables..."

# Check if database has tables already
TABLES_COUNT=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null || echo "0")
TABLES_COUNT=$(echo $TABLES_COUNT | tr -d ' ')

if [ "$TABLES_COUNT" = "0" ]; then
  echo "No tables found. Running initial schema push..."
  
  # Push the schema to the database
  bunx prisma db push --skip-generate

  # Check if the migration was successful
  if [ $? -ne 0 ]; then
    echo "Failed to push Prisma schema. Exiting."
    exit 1
  fi

  echo "Schema push completed successfully!"

  # Apply TimescaleDB extensions
  echo "Applying TimescaleDB extensions..."
  psql postgresql://postgres:postgres@timescaledb:5432/trading_app -f /app/scripts/init-timescaledb.sql

  echo "TimescaleDB setup complete!"

  # Seed the database if needed
  if [ -n "$SEED_DATABASE" ]; then
    echo "Seeding the database..."
    bash /app/scripts/db-init.sh
  fi
else
  echo "Database already has $TABLES_COUNT tables. Skipping initial schema push."
  
  # Verify the TimescaleDB extension is properly installed
  TIMESCALE_INSTALLED=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT count(*) FROM pg_extension WHERE extname = 'timescaledb'" 2>/dev/null || echo "0")
  TIMESCALE_INSTALLED=$(echo $TIMESCALE_INSTALLED | tr -d ' ')
  
  if [ "$TIMESCALE_INSTALLED" = "0" ]; then
    echo "TimescaleDB extension not found. Installing..."
    psql postgresql://postgres:postgres@timescaledb:5432/trading_app -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
  else
    echo "TimescaleDB extension already installed."
  fi
  
  # Verify if OHLCV table is a hypertable
  OHLCV_TABLE_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT count(*) FROM information_schema.tables WHERE table_name = 'OHLCV'" 2>/dev/null || echo "0")
  OHLCV_TABLE_EXISTS=$(echo $OHLCV_TABLE_EXISTS | tr -d ' ')
  
  if [ "$OHLCV_TABLE_EXISTS" != "0" ]; then
    HYPERTABLE_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT count(*) FROM timescaledb_information.hypertables WHERE hypertable_name = 'OHLCV'" 2>/dev/null || echo "0")
    HYPERTABLE_EXISTS=$(echo $HYPERTABLE_EXISTS | tr -d ' ')
    
    if [ "$HYPERTABLE_EXISTS" = "0" ]; then
      echo "OHLCV table exists but is not a hypertable. Converting to hypertable..."
      psql postgresql://postgres:postgres@timescaledb:5432/trading_app -c "SELECT create_hypertable('\"OHLCV\"', 'time', if_not_exists => TRUE, migrate_data => TRUE);"
    else
      echo "OHLCV is already a hypertable."
    fi
  fi
fi

echo "All database setup steps completed successfully!" 