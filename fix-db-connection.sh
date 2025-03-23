#!/bin/bash
set -e

# Check if container is running
echo "Checking existing containers..."
docker ps

# Function to check if PostgreSQL is ready
check_postgres() {
  docker exec timescaledb pg_isready -U postgres || return 1
  return 0
}

# Stop the backend container
echo "Stopping backend container..."
docker stop trading-backend-2 || true

# Make sure the database is up and running
if ! docker ps | grep -q timescaledb; then
  echo "TimescaleDB container is not running. Starting it..."
  docker start timescaledb || docker run -d \
    --name timescaledb \
    --network trading-network \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=trading_app \
    -v timescale_data:/var/lib/postgresql/data \
    --restart unless-stopped \
    timescale/timescaledb:latest-pg14
fi

# Wait for database to initialize (with timeout)
echo "Waiting for database to initialize..."
TIMEOUT=60
COUNTER=0
until check_postgres || [ $COUNTER -eq $TIMEOUT ]; do
  echo "Waiting for PostgreSQL to become ready... ($COUNTER/$TIMEOUT)"
  sleep 3
  COUNTER=$((COUNTER+1))
done

if [ $COUNTER -eq $TIMEOUT ]; then
  echo "Error: PostgreSQL did not become ready within $TIMEOUT seconds"
  docker logs timescaledb
  exit 1
fi

echo "PostgreSQL is now ready!"

# Create the trading_app database if it doesn't exist
echo "Ensuring database exists..."
docker exec timescaledb psql -U postgres -c "CREATE DATABASE trading_app;" 2>/dev/null || echo "Database already exists"

# Update the backend container to use the correct database URL
echo "Starting backend container with correct database URL..."
docker rm trading-backend-2 || true
docker run -d \
  --name trading-backend-2 \
  --network trading-network \
  -p 3001:3001 \
  --restart unless-stopped \
  -e DATABASE_URL="postgresql://postgres:postgres@timescaledb:5432/trading_app?schema=public" \
  -e JWT_SECRET="your-secret-key-here" \
  -e NODE_ENV="production" \
  -e PORT="3001" \
  yashmakhija/trading-app-backend:latest

# Verify deployment
echo "Verifying containers are running:"
docker ps

# Check the logs of the backend to ensure it's working properly
echo "Checking backend logs:"
sleep 5
docker logs trading-backend-2

echo "Fix complete! The backend should now be connected to TimescaleDB."
echo "If you still have issues, check the logs for specific error messages." 