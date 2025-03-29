# Candle Data System Architecture

## Overview

The Candle Data System is the core component of our trading platform responsible for providing accurate, real-time price data across multiple timeframes. This document outlines the system's architecture, data flow, and integration points.

## System Components

![Candle Data System Architecture](../assets/candle-data-architecture.png)

### 1. Data Sources

- **Binance WebSocket API**: Primary source for real-time 1-minute candle data.
- **Binance REST API**: Used for backfilling historical data when needed.

### 2. Backend Services

- **Binance Service**: Manages connections to Binance APIs and handles reconnection logic.
- **Candle Service**: Core service that processes, aggregates, and stores candle data.
- **WebSocket Service**: Manages client connections and broadcasts candle updates.
- **Redis Service**: Handles caching of recent candle data for all timeframes.

### 3. Data Storage

- **TimescaleDB**: Time-series database optimized for storing historical candle data.
- **Redis**: In-memory cache for frequently accessed recent candle data.

### 4. API Layer

- **HTTP Controllers**: REST endpoints for retrieving historical candle data.
- **WebSocket Controllers**: Real-time streaming of candle updates to clients.

## Data Flow

### Real-time Data Path

1. **Acquisition**:

   - The Binance Service establishes a WebSocket connection with Binance.
   - Subscribes to 1-minute kline streams for all configured trading symbols.

2. **Processing**:

   - Raw WebSocket messages are parsed and converted to our internal OHLCV format.
   - The 1-minute candle is stored in TimescaleDB and cached in Redis.

3. **Aggregation**:

   - When a 1-minute candle arrives at a timeframe boundary (e.g., exactly at XX:05:00 for 5m):
     - The system retrieves all 1-minute candles within the boundary period.
     - Aggregates them into a single higher timeframe candle (open from first, high as max, low as min, close from last).
     - Stores the aggregated candle in TimescaleDB and updates Redis cache.

4. **Distribution**:
   - All updated candles (both 1-minute and derived timeframes) are broadcasted to connected clients.
   - Data is sent in a standardized format regardless of timeframe.

### Historical Data Path

1. **Request**:

   - Client requests historical candles for a specific symbol, timeframe, and date range.

2. **Cache Check**:

   - System first checks Redis for cached candles matching the request parameters.
   - If found and sufficient, returns the cached data.

3. **Database Retrieval**:

   - If not in cache or insufficient, queries TimescaleDB for the requested candles.
   - If data exists for the requested timeframe, returns it directly.

4. **Dynamic Aggregation**:

   - If the database lacks sufficient data for the requested timeframe:
     - System cascades to the next smaller timeframe and aggregates on-demand.
     - This process may recurse down to 1-minute candles if necessary.

5. **Cache Update**:

   - Retrieved or aggregated historical data is cached in Redis for future requests.

6. **Response**:
   - Formatted candle data is returned to the client.

## Key Implementations

### 1. Timeframe Management

The system supports multiple standard timeframes:

- 1 minute (1m)
- 5 minutes (5m)
- 15 minutes (15m)
- 30 minutes (30m)
- 1 hour (1h)
- 4 hours (4h)
- 1 day (1d)

Each timeframe is represented as an enum:

```typescript
export enum Timeframe {
  ONE_MINUTE = "1m",
  FIVE_MINUTES = "5m",
  FIFTEEN_MINUTES = "15m",
  THIRTY_MINUTES = "30m",
  ONE_HOUR = "1h",
  FOUR_HOURS = "4h",
  ONE_DAY = "1d",
}
```

### 2. Candle Data Structure

The OHLCV (Open, High, Low, Close, Volume) model represents candle data:

```typescript
interface OHLCV {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

In our database, prices are stored as integers (cents) to avoid floating-point precision issues. They are converted to floating-point (dollars) when sent to clients.

### 3. Reconnection Strategy

The Binance Service implements an exponential backoff strategy for WebSocket reconnections:

```typescript
private reconnect() {
  this.reconnectAttempts += 1;
  const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
  console.log(`Reconnecting in ${delay / 1000} seconds...`);

  setTimeout(() => {
    this.connectWebSocket();
  }, delay);
}
```

### 4. API Endpoints

#### HTTP Endpoints:

- `GET /api/candles/:symbol/:timeframe` - Get historical candles with optional parameters:
  - `limit`: Number of candles to retrieve (default: 100)
  - `startTime`: ISO string or Unix timestamp in milliseconds
  - `endTime`: ISO string or Unix timestamp in milliseconds

#### WebSocket Commands:

- `SUBSCRIBE_CANDLES`: Subscribe to real-time candle updates for symbol and timeframe
- `UNSUBSCRIBE_CANDLES`: Unsubscribe from candle updates
- `GET_CANDLE_HISTORY`: Request historical candles (similar parameters to HTTP endpoint)

## Security Considerations

1. **Rate Limiting**:

   - All public API endpoints are rate-limited to prevent abuse.
   - WebSocket connections per IP are limited to prevent connection exhaustion.

2. **Data Validation**:

   - All incoming data (both from Binance and clients) is validated before processing.
   - Symbol whitelist prevents processing data for unsupported trading pairs.

3. **Error Handling**:
   - Service degrades gracefully during Binance API outages.
   - Separate error logs track data inconsistencies for later review.

## Performance Optimization

1. **Database Indexing**:

   - TimescaleDB hypertables are optimized for time-series queries.
   - Composite indexes support efficient filtering by symbol, timeframe, and time.

2. **Cache Management**:

   - Redis cache implements timeframe-specific TTL and size limits.
   - LRU eviction policy ensures most relevant data is retained when memory pressure occurs.

3. **Connection Pooling**:

   - Database connections are pooled to minimize connection overhead.
   - Connection limits prevent resource exhaustion during traffic spikes.

4. **Batch Processing**:
   - Historical data is processed in batches to optimize throughput.
   - Bulk database operations reduce query overhead.

## Monitoring and Logging

1. **Health Metrics**:

   - Service uptime and response times are tracked.
   - WebSocket connection counts and message rates are monitored.

2. **Data Quality Metrics**:

   - Gaps in candle sequences are tracked and logged.
   - Reconnection attempts and durations are recorded.

3. **Resource Utilization**:
   - Memory usage, especially Redis cache size, is monitored.
   - Database query performance and slow query logs are analyzed.

## Conclusion

The Candle Data System provides a robust foundation for our trading platform by ensuring reliable, real-time price data across multiple timeframes. By adopting a "1-minute first" approach, we maintain data consistency while optimizing for both performance and resource utilization.

For implementation details about the timeframe aggregation process, please refer to the [Timeframe Aggregation Implementation Guide](./timeframe-aggregation.md).
