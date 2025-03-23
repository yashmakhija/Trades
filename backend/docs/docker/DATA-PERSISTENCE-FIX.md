# Fixing Data Persistence in Docker

This document provides a step-by-step guide to fix data persistence issues in the Trading App's Docker setup.

## Problem Description

When running `docker-compose down` and then `docker-compose up -d` again (or rebuilding with `docker-compose build`), data is being lost despite using named volumes.

## Solution: Using External Volumes

The most reliable way to ensure data persistence is to use **external volumes**. External volumes are created outside the docker-compose context and won't be deleted during `docker-compose down` operations, even with the `-v` flag.

## Step 1: Create an External Volume

First, create a permanent external volume:

```bash
docker volume create trading_db_data
```

This creates a named volume that will persist regardless of docker-compose operations.

## Step 2: Update docker-compose.yml

Modify your `docker-compose.yml` file to use this external volume:

```yaml
volumes:
  trading_db_data:
    name: trading_db_data
    external: true
```

The `external: true` directive tells Docker that this volume is managed outside of docker-compose and should not be created or removed by docker-compose operations.

## Step 3: Backup Your Existing Data (If Any)

If you have valuable data that you want to preserve:

```bash
# If you have existing containers running
docker exec -it backend-timescaledb-1 pg_dump -U postgres -d trading_app -F c -f /tmp/backup.dump
docker cp backend-timescaledb-1:/tmp/backup.dump ./backup.dump

# Stop current containers
docker-compose down
```

## Step 4: Apply the Changes

After updating your `docker-compose.yml` file and creating the external volume:

```bash
# Start the services with the external volume
docker-compose up -d
```

## Step 5: Restore Data If Needed

If you had to back up data in Step 3:

```bash
# Copy backup to container
docker cp ./backup.dump backend-timescaledb-1:/tmp/backup.dump

# Restore the database
docker exec -it backend-timescaledb-1 pg_restore -U postgres -d trading_app -c /tmp/backup.dump
```

## Additional SafeGuards

### 1. Never Use `-v` Flag with `docker-compose down`

Even with external volumes, it's good practice to avoid:

```bash
docker-compose down -v  # This removes all volumes defined in docker-compose.yml
```

Instead, use:

```bash
docker-compose down  # This preserves volumes
```

### 2. Regular Backups

Set up regular database backups:

```bash
# Create a backup script
echo '#!/bin/bash
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker exec backend-timescaledb-1 pg_dump -U postgres -d trading_app -F c -f /tmp/backup.dump
docker cp backend-timescaledb-1:/tmp/backup.dump $BACKUP_DIR/trading_app-$TIMESTAMP.dump
echo "Backup created: $BACKUP_DIR/trading_app-$TIMESTAMP.dump"
' > backup-db.sh

chmod +x backup-db.sh
```

### 3. Docker Volume Management

Check your volume status:

```bash
# List all volumes
docker volume ls

# Inspect the trading_db_data volume
docker volume inspect trading_db_data
```

### 4. Safe Rebuild Command Sequence

When you need to rebuild:

```bash
# Stop containers but keep volumes
docker-compose down

# Rebuild services
docker-compose build

# Start services again with persistent data
docker-compose up -d
```

## Troubleshooting Continued Data Loss

If you're still experiencing data loss after implementing external volumes:

1. **Verify Volume Mounting**: Check that the volume is correctly mounted:

   ```bash
   docker inspect backend-timescaledb-1 | grep -A 10 Mounts
   ```

2. **Check Database Initialization**: Look at the container logs:

   ```bash
   docker-compose logs timescaledb
   ```

   Verify it says "PostgreSQL Database directory appears to contain a database; Skipping initialization"

3. **Verify Data Directory**: Ensure PostgreSQL is using the mounted volume for data:

   ```bash
   docker exec -it backend-timescaledb-1 psql -U postgres -c "SHOW data_directory;"
   ```

4. **Database Shutdown Issues**: Ensure the database is shutting down properly:
   ```bash
   # Proper shutdown
   docker-compose stop timescaledb
   # Wait 10 seconds before down
   sleep 10
   docker-compose down
   ```

## Conclusion

By using external volumes and following proper Docker data management practices, your trading app data should persist reliably across container rebuilds and restarts.

After implementing these changes, you'll be able to safely:

1. Stop containers with `docker-compose down`
2. Rebuild with `docker-compose build`
3. Start again with `docker-compose up -d`

And your data will be preserved throughout this process.
