# TimescaleDB Setup with Docker

This document explains how the Trading App integrates with TimescaleDB in a Docker environment, including the initialization process and common troubleshooting steps.

## Overview

The Trading App uses TimescaleDB, a PostgreSQL extension optimized for time-series data, for storing historical price data. Our Docker setup ensures that:

1. The TimescaleDB container starts and initializes properly
2. The database schema is created using Prisma migrations
3. TimescaleDB extensions are properly installed and configured
4. The OHLCV table is converted to a hypertable for efficient time-series queries

## Initialization Process

When the containers start, the following sequence occurs:

1. **TimescaleDB Container Start**: The database initializes with the specified credentials
2. **Health Check**: The backend waits for the database to be healthy before connecting
3. **Schema Deployment**: Prisma automatically pushes the schema to the database
4. **TimescaleDB Extensions**: Custom SQL is executed to set up TimescaleDB features
5. **Application Start**: Once the database is ready, the application starts

## Key Components

### 1. Docker Compose Configuration

The `docker-compose.yml` file contains the TimescaleDB service configuration:

```yaml
timescaledb:
  image: timescale/timescaledb:latest-pg14
  ports:
    - "5432:5432"
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: trading_app
  volumes:
    - timescale_data:/var/lib/postgresql/data
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - trading-network
  command: >
    postgres -c shared_preload_libraries=timescaledb
            -c timescaledb.telemetry_level=off
```

### 2. Database Migration Script

The `run-migrations.sh` script handles the database setup:

```bash
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

echo "Database is ready, running Prisma migrations..."

# Push the schema to the database
bunx prisma db push --skip-generate

echo "Schema push completed successfully!"

# Apply TimescaleDB extensions
echo "Applying TimescaleDB extensions..."
psql postgresql://postgres:postgres@timescaledb:5432/trading_app -f /app/scripts/init-timescaledb.sql

echo "TimescaleDB setup complete!"
```

### 3. TimescaleDB Initialization SQL

The `init-timescaledb.sql` script configures TimescaleDB:

```sql
-- Create TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- After Prisma has created the tables, convert OHLCV to a hypertable
SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE);

-- Create appropriate indexes for TimescaleDB to work efficiently
CREATE INDEX IF NOT EXISTS "idx_ohlcv_symbol_time" ON "OHLCV" ("symbolId", "time" DESC);

-- Set chunk time interval to 1 day (for development, adjust for production)
SELECT set_chunk_time_interval('"OHLCV"', INTERVAL '1 day');
```

## Verification Steps

After starting the containers, you can verify the TimescaleDB setup by:

1. **Connecting to the Database**:

   ```bash
   docker exec -it backend-timescaledb-1 psql -U postgres -d trading_app
   ```

2. **Checking TimescaleDB Extension**:

   ```sql
   \dx
   ```

   You should see timescaledb in the list of extensions.

3. **Verify Hypertable Creation**:

   ```sql
   SELECT * FROM timescaledb_information.hypertables;
   ```

   The `OHLCV` table should be listed as a hypertable.

4. **Check Database Tables**:

   ```sql
   \dt
   ```

   You should see all tables from the Prisma schema.

## Backup and Restore

The database data is persisted using a Docker volume:

```yaml
volumes:
  timescale_data:
    driver: local
```

### Creating a Database Backup

```bash
docker exec -it backend-timescaledb-1 pg_dump -U postgres -d trading_app -F c -f /tmp/backup.dump
docker cp backend-timescaledb-1:/tmp/backup.dump ./backup.dump
```

### Restoring from Backup

```bash
docker cp ./backup.dump backend-timescaledb-1:/tmp/backup.dump
docker exec -it backend-timescaledb-1 pg_restore -U postgres -d trading_app -c /tmp/backup.dump
```

## Common Issues and Troubleshooting

### 1. TimescaleDB Extension Not Installed

**Symptoms**: Error messages about timescaledb extension not being available

**Solution**:

- Connect to the database and run:
  ```sql
  CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
  ```

### 2. Hypertable Not Created

**Symptoms**: Slow queries against the OHLCV table

**Solution**:

- Connect to the database and run:
  ```sql
  SELECT create_hypertable('"OHLCV"', 'time', if_not_exists => TRUE);
  ```

### 3. Database Connection Failures

**Symptoms**: Backend service fails to start with database connection errors

**Solution**:

- Check network configuration in docker-compose.yml
- Verify database credentials
- Ensure TimescaleDB container is healthy
- Increase timeout/retry values in run-migrations.sh

### 4. Prisma Schema Push Fails

**Symptoms**: Error messages from Prisma during schema push

**Solution**:

- Check if tables already exist with conflicting schemas
- Examine Prisma logs for specific error details
- Try manually running:
  ```bash
  docker exec -it trading-backend bunx prisma db push --skip-generate
  ```

## Production Considerations

For production environments, consider:

1. **Data Persistence**: Use a managed volume solution or external PostgreSQL service
2. **Backup Strategy**: Implement regular automated backups
3. **Security**: Use strong passwords and restrict network access
4. **Scaling**: Consider read replicas for high query loads
5. **Monitoring**: Set up alerts for database health and performance

## Additional Resources

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Prisma with PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)
