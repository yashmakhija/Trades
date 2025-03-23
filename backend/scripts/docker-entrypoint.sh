#!/bin/bash
set -e

# Create .env from example if not exists
if [ ! -f .env ]; then
  echo "Creating .env file from example..."
  cp .env.example .env
fi

# Check if SKIP_DB_CHECKS is set
if [ "${SKIP_DB_CHECKS:-false}" = "true" ]; then
  echo "Skipping database checks as SKIP_DB_CHECKS=true"
else
  # Wait for database to be ready
  echo "Waiting for database..."
  bun src/scripts/wait-for-db.js

  # Run migrations
  echo "Running migrations..."
  bunx prisma db push

  # Initialize database
  echo "Initializing database..."
  bun src/scripts/initDb.ts

  # Setup TimescaleDB if needed
  echo "Checking TimescaleDB extension..."
  bun db:check-timescale
fi

# Start server
echo "Starting server..."
exec bun src/index.ts 