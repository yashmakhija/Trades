# Database and Cache Architecture

## Overview

Our trading application uses two main data stores:

1. **TimescaleDB**: A time-series database for storing OHLCV (Open, High, Low, Close, Volume) data and other time-series data
2. **Redis**: An in-memory cache for real-time data, session management, and rate limiting

## TimescaleDB

### Purpose

- Stores historical OHLCV data for all trading pairs
- Manages time-series data efficiently with automatic partitioning
- Handles complex time-based queries for technical analysis
- Stores user preferences and application settings

### Key Features

1. **Hypertables**

   - Automatically partitions data by time
   - Improves query performance for time-series data
   - Enables efficient data retention policies

2. **Data Retention**

   - Configurable retention periods for different timeframes
   - Automatic data compression for older data
   - Efficient storage management

3. **Query Optimization**
   - Specialized indexes for time-series data
   - Efficient aggregation functions
   - Support for complex time-based queries

### Schema

```sql
-- OHLCV Data
CREATE TABLE ohlcv (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    open DECIMAL NOT NULL,
    high DECIMAL NOT NULL,
    low DECIMAL NOT NULL,
    close DECIMAL NOT NULL,
    volume DECIMAL NOT NULL,
    PRIMARY KEY (time, symbol, timeframe)
);

-- Convert to hypertable
SELECT create_hypertable('ohlcv', 'time');
```

## Redis

### Purpose

1. **Real-time Data Cache**

   - Stores current market prices
   - Caches frequently accessed OHLCV data
   - Reduces database load for common queries

2. **Session Management**

   - Stores user sessions
   - Manages authentication tokens
   - Handles user preferences

3. **Rate Limiting**

   - Controls API request rates
   - Prevents abuse of the system
   - Manages concurrent connections

4. **WebSocket State**
   - Maintains active WebSocket connections
   - Stores real-time subscription states
   - Manages user notifications

### Key Features

1. **Data Types**

   - Strings: For simple key-value pairs
   - Hashes: For storing user sessions and preferences
   - Sorted Sets: For time-series data and leaderboards
   - Lists: For real-time notifications and events

2. **Performance**
   - In-memory storage for fast access
   - Automatic data expiration
   - Efficient data structures for different use cases

### Configuration

```yaml
# Redis Configuration
REDIS_HOST: host.docker.internal
REDIS_PORT: 6379
REDIS_PASSWORD: tradingapp
REDIS_DB: 0

# Memory Settings
maxmemory: 512mb
maxmemory-policy: allkeys-lru
```

## Integration

### Data Flow

1. **Market Data**

   - Real-time data → Redis → TimescaleDB
   - Historical data → TimescaleDB
   - Cached data → Redis

2. **User Sessions**

   - Session data → Redis
   - User preferences → TimescaleDB
   - Authentication → Redis

3. **System State**
   - Rate limiting → Redis
   - WebSocket state → Redis
   - System metrics → TimescaleDB

### Deployment

1. **TimescaleDB**

   - Runs in Docker container
   - Exposed on port 5432
   - Persistent volume for data storage
   - Automatic backups

2. **Redis**
   - Runs on host machine
   - Exposed on port 6379
   - Password protected
   - Memory limits configured

## Monitoring and Maintenance

### Health Checks

1. **TimescaleDB**

   - Connection status
   - Query performance
   - Storage usage
   - Replication status

2. **Redis**
   - Connection status
   - Memory usage
   - Hit/miss rates
   - Command latency

### Backup Strategy

1. **TimescaleDB**

   - Daily full backups
   - Continuous WAL archiving
   - Point-in-time recovery

2. **Redis**
   - RDB snapshots
   - AOF persistence
   - Regular backup verification

## Security

### Access Control

1. **TimescaleDB**

   - User authentication
   - Role-based access
   - SSL encryption
   - Network isolation

2. **Redis**
   - Password protection
   - Network binding
   - Command filtering
   - Memory limits

## Performance Optimization

### TimescaleDB

1. **Query Optimization**

   - Materialized views
   - Index optimization
   - Partition pruning
   - Query planning

2. **Storage Optimization**
   - Compression policies
   - Retention policies
   - Vacuum scheduling
   - WAL management

### Redis

1. **Memory Management**

   - Eviction policies
   - Memory limits
   - Key expiration
   - Data structure optimization

2. **Performance Tuning**
   - Connection pooling
   - Command pipelining
   - Memory fragmentation
   - Latency monitoring
