# Docker Data Persistence

This document explains how data persistence is managed in the Trading App Docker environment, ensuring that your data remains intact across container rebuilds and updates.

## Overview

The Trading App utilizes a multi-container setup with a PostgreSQL/TimescaleDB database. Data persistence is a critical concern to ensure that:

1. Trading history is preserved
2. User accounts remain intact
3. Configuration settings are maintained
4. Historical price data is retained

## Persistence Strategy

### Named Volumes

The primary method for data persistence is Docker named volumes. Unlike anonymous volumes, named volumes have the following advantages:

- They persist after `docker-compose down` (unless `-v` flag is used)
- They can be easily backed up
- They can be referenced by name in different compose files
- They survive container and image rebuilds

In our `docker-compose.yml`, we define a named volume:

```yaml
volumes:
  trading_db_data:
    name: trading_db_data
    driver: local
```

This volume is then mounted to the PostgreSQL data directory:

```yaml
timescaledb:
  # ...other configuration...
  volumes:
    - trading_db_data:/var/lib/postgresql/data
```

## Safe Rebuild Process

To rebuild containers without losing data, follow these steps:

```bash
# Stop the containers but keep volumes
docker-compose down

# Rebuild the services
docker-compose build

# Start the services again
docker-compose up -d
```

Avoid using `docker-compose down -v` as this will delete all volumes and your data will be lost.

## Data Initialization Safeguards

We've implemented several safeguards to protect existing data:

1. **Database Detection**: The initialization scripts check if tables already exist before attempting to create them
2. **Non-Destructive Updates**: Any data seeding uses `ON CONFLICT` clauses to update rather than replace data
3. **Intelligent Schema Handling**: If tables exist, only missing tables are created rather than rebuilding the entire schema

These safeguards are implemented in:

- `entrypoint.sh` in the Dockerfile
- `run-migrations.sh` for database schema
- `db-init.sh` for sample data

## Backup and Restore

### Creating a Database Backup

```bash
# Create a database dump
docker exec -it backend-timescaledb-1 pg_dump -U postgres -d trading_app -F c -f /tmp/backup.dump

# Copy the dump to your host machine
docker cp backend-timescaledb-1:/tmp/backup.dump ./backups/backup-$(date +%Y%m%d).dump
```

### Restoring from Backup

```bash
# Copy backup to container
docker cp ./backups/your-backup.dump backend-timescaledb-1:/tmp/backup.dump

# Restore the database
docker exec -it backend-timescaledb-1 pg_restore -U postgres -d trading_app -c /tmp/backup.dump
```

## Volume Management

### Listing Volumes

```bash
docker volume ls | grep trading
```

### Inspecting a Volume

```bash
docker volume inspect trading_db_data
```

### Backing Up a Volume

```bash
# Create a backup directory
mkdir -p ./volume-backups

# Run a temporary container to backup the volume
docker run --rm -v trading_db_data:/data -v $(pwd)/volume-backups:/backup alpine tar czf /backup/trading_db_data-$(date +%Y%m%d).tar.gz /data
```

### Restoring a Volume

```bash
# Create a new volume if it doesn't exist
docker volume create trading_db_data

# Restore from backup using a temporary container
docker run --rm -v trading_db_data:/data -v $(pwd)/volume-backups:/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/your-volume-backup.tar.gz -C /data --strip-components=1"
```

## Common Scenarios

### Updating the Application Code

If you're only updating the application code without changing the database schema:

```bash
docker-compose build backend
docker-compose up -d backend
```

Your data will remain intact.

### Updating Database Schema

When updating the database schema:

1. Always back up your data first
2. Update your Prisma schema
3. Test schema migrations locally
4. Use the `--skip-migrate-data` flag in production if available

### Complete System Rebuild

If you need to completely rebuild:

```bash
# Backup your volume first!
docker run --rm -v trading_db_data:/data -v $(pwd)/volume-backups:/backup alpine tar czf /backup/trading_db_data-$(date +%Y%m%d).tar.gz /data

# Then rebuild without removing volumes
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Volume Not Persisting

If your data isn't persisting after rebuilds:

1. Check if you're using `docker-compose down -v` (which removes volumes)
2. Verify the volume name in `docker-compose.yml` matches what's in `docker volume ls`
3. Ensure the database container is properly shutting down to flush data to disk

### Data Corruption

If database corruption occurs:

1. Stop containers: `docker-compose down`
2. Restore from your most recent backup
3. Check logs for any disk issues: `docker-compose logs timescaledb`

## Best Practices

1. **Regular Backups**: Schedule automatic backups of your volumes
2. **Version Control**: Include database schema changes in your version control
3. **Test Migrations**: Always test schema changes on a copy of production data
4. **Monitoring**: Set up alerts for disk space and database health
5. **Documentation**: Keep records of all major schema changes
