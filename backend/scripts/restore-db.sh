#!/bin/bash
# Database restore script for Trading App

# Check if a filename was provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup-filename>"
  echo "Example: $0 ./backups/trading_app-20250323-123456.dump"
  exit 1
fi

BACKUP_FILE=$1
CONTAINER_NAME="backend-timescaledb-1"
DB_NAME="trading_app"
DB_USER="postgres"

# Check if the backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found."
  exit 1
fi

echo "Starting database restore process from '$BACKUP_FILE'..."

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
  echo "Error: Container $CONTAINER_NAME is not running."
  exit 1
fi

# Confirm before proceeding
echo "WARNING: This will overwrite the current database. All existing data will be lost."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 0
fi

# Copy the backup file to the container
echo "Copying backup file to container..."
if ! docker cp "$BACKUP_FILE" $CONTAINER_NAME:/tmp/restore.dump; then
  echo "Error: Failed to copy backup file to container."
  exit 1
fi

# Stop the backend service to avoid any connections during restore
echo "Stopping backend service..."
docker stop trading-backend || true

# Drop the existing database and create a new one
echo "Recreating the database..."
docker exec $CONTAINER_NAME psql -U $DB_USER -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "DROP DATABASE IF EXISTS ${DB_NAME}_temp;"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "CREATE DATABASE ${DB_NAME}_temp;"

# Restore the backup to the temporary database
echo "Restoring backup to temporary database..."
if ! docker exec $CONTAINER_NAME pg_restore -U $DB_USER -d ${DB_NAME}_temp -v /tmp/restore.dump; then
  echo "Warning: Restore completed with some errors (this can be normal for certain constraints)."
else
  echo "Restore to temporary database completed successfully."
fi

# Swap the databases
echo "Swapping databases..."
docker exec $CONTAINER_NAME psql -U $DB_USER -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE (datname = '$DB_NAME' OR datname = '${DB_NAME}_temp') AND pid <> pg_backend_pid();"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"
docker exec $CONTAINER_NAME psql -U $DB_USER -c "ALTER DATABASE ${DB_NAME}_temp RENAME TO $DB_NAME;"

# Remove temporary dump file from container
docker exec $CONTAINER_NAME rm -f /tmp/restore.dump

# Restart the backend service
echo "Starting backend service..."
docker start trading-backend

echo "Restore completed successfully!"
echo "The old database is still available as '${DB_NAME}_old' if needed."
echo "You can remove it with: docker exec $CONTAINER_NAME psql -U $DB_USER -c 'DROP DATABASE ${DB_NAME}_old;'"
echo "Backend service has been restarted." 