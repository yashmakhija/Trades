#!/bin/bash
# Automated database backup script for Trading App

# Configuration
BACKUP_DIR="./backups"
CONTAINER_NAME="backend-timescaledb-1"
DB_NAME="trading_app"
DB_USER="postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILENAME="trading_app-${TIMESTAMP}.dump"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting database backup process..."

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
  echo "Error: Container $CONTAINER_NAME is not running."
  exit 1
fi

# Execute pg_dump inside the container
echo "Creating database dump inside container..."
if ! docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F c -f /tmp/backup.dump; then
  echo "Error: Failed to create database dump."
  exit 1
fi

# Copy the dump from the container to host
echo "Copying dump file from container to host..."
if ! docker cp $CONTAINER_NAME:/tmp/backup.dump "$BACKUP_DIR/$BACKUP_FILENAME"; then
  echo "Error: Failed to copy dump file from container."
  exit 1
fi

# Remove the temporary dump file from container
docker exec $CONTAINER_NAME rm -f /tmp/backup.dump

# Show success message with backup details
echo "Backup completed successfully!"
echo "Backup file: $BACKUP_DIR/$BACKUP_FILENAME"
echo "Date: $(date)"
echo "Size: $(du -h "$BACKUP_DIR/$BACKUP_FILENAME" | cut -f1)"

# Optional: Keep only the last 5 backups
echo "Cleaning up old backups..."
cd $BACKUP_DIR && ls -t *.dump | tail -n +6 | xargs --no-run-if-empty rm
echo "Cleanup complete. Kept the 5 most recent backups." 