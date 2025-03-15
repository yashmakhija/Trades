# Trading Platform

A real-time trading platform that connects to Binance for market data and allows users to trade cryptocurrencies with features like stop-loss and take-profit orders.

## Project Overview

This platform provides:

- Real-time market data from Binance
- Live price charts for multiple cryptocurrencies
- Trading capabilities with stop-loss and take-profit
- In-memory order management
- User balance tracking
- Historical data storage with TimescaleDB
- Efficient time-series data aggregation

## Recent Improvements

We've made several key improvements to the codebase to make it production-ready:

1. **Standardized Database Connections**: Implemented a singleton pattern for Prisma client to prevent connection pool exhaustion and improve performance.

2. **Enhanced Authentication**: Added JWT-based authentication with proper middleware for securing routes.

3. **Optimized Trading Engine**: Streamlined the order management system with efficient in-memory data structures.

4. **TimescaleDB Integration**: Implemented a robust historical candle data system with TimescaleDB for efficient time-series storage and aggregation.

5. **Retention Policies**: Added both application-level (last 100 candles) and database-level (7-day) retention policies for optimal data management.

6. **Continuous Aggregates**: Created pre-computed views for different timeframes (5m, 15m, 1h, 1d) to optimize query performance.

7. **Code Cleanup**: Removed excessive comments and improved documentation for better maintainability.

8. **API Documentation**: Added comprehensive Swagger documentation for all endpoints.

9. **Comprehensive Testing**: Added extensive test suite covering all components and workflows.

## Testing

The platform includes a comprehensive test suite that covers all major components and workflows:

### Test Structure

- **Unit Tests**: Test individual components in isolation (auth, orders, symbols)
- **Service Tests**: Test service layer functionality (OrderManager, BalanceManager)
- **Integration Tests**: Test complete workflows across multiple components
- **Candle Data Tests**: Verify TimescaleDB integration and data aggregation

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run a specific test file
bun test src/tests/auth.test.ts

# Test candle data system
bun run test:candles
```

### Test Coverage

The tests cover:

- Authentication flows
- Order management
- Symbol information
- Trading logic (stop-loss/take-profit)
- Balance management
- Complete trading workflows
- Historical candle data storage and retrieval
- Time-series data aggregation

## Areas to Focus On

The following areas require additional attention:

1. **Concurrency Management**: The trading engine needs robust concurrency handling to prevent race conditions during high-volume trading.

2. **Error Handling**: Implement more comprehensive error handling and recovery mechanisms throughout the application.

3. **Performance Testing**: Conduct load testing to ensure the system can handle production traffic volumes.

4. **Security Auditing**: Perform a thorough security audit, especially for authentication and order execution flows.

5. **Monitoring and Logging**: Enhance logging and add monitoring for critical system components.

6. **Data Compression**: Configure TimescaleDB compression for older candle data to optimize storage.

## Most Challenging Components

During development, these components presented the greatest challenges:

1. **Price Trigger System**: Implementing an efficient system to monitor price changes and trigger stop-loss and take-profit orders required careful design to balance performance with accuracy.

2. **Balance Management**: Ensuring accurate tracking of user balances, especially during concurrent order executions, was complex and required a robust locking mechanism.

3. **WebSocket Connection Management**: Handling large numbers of concurrent WebSocket connections while maintaining low latency for price updates required optimization.

4. **Order Execution Logic**: Implementing the business logic for order execution, especially for short positions and calculating profit/loss correctly, required careful testing.

5. **Database Connection Pooling**: Standardizing the Prisma client usage across the application to prevent connection pool exhaustion was critical for stability.

6. **TimescaleDB Integration**: Setting up and optimizing TimescaleDB for efficient time-series data storage and aggregation required careful configuration.

## Backend Architecture

The backend is built with:

- **Node.js & TypeScript**: For type-safe server-side code
- **Express**: Web server framework
- **WebSockets**: For real-time data streaming
- **Prisma**: Database ORM for PostgreSQL
- **TimescaleDB**: For efficient time-series data storage
- **Binance API**: For market data
- **Bun**: Fast JavaScript runtime and package manager

### Key Components

#### 1. WebSocket Service

- Connects to Binance WebSocket API
- Forwards real-time market data to clients
- Handles client subscriptions to specific symbols
- Manages client connections and message broadcasting
- Supports user authentication for private channels
- Broadcasts order updates and balance changes
- Provides real-time candle data updates

#### 2. Trading Engine

- In-memory order management
- Price trigger monitoring for stop-loss and take-profit
- Order matching and execution
- Balance management

#### 3. Data Processing

- Processes raw Binance data into usable formats
- Creates OHLCV candles from trade data
- Stores historical data in TimescaleDB
- Aggregates candles to different timeframes

#### 4. API Endpoints

- RESTful API for historical data
- Symbol information endpoints
- User management endpoints
- Order placement and cancellation
- Candle data retrieval and aggregation
- Swagger documentation

#### 5. Candle Data System

- Efficient storage of 1-minute candles as base data
- Automatic aggregation to larger timeframes (5m, 15m, 1h, 1d)
- Retention policy to keep only the last 100 candles per symbol/timeframe
- TimescaleDB continuous aggregates for optimized queries
- Fallback to manual aggregation when needed

## Current Progress (100% Complete)

### Completed Features

✅ **Binance WebSocket Integration**

- Real-time connection to Binance
- Multi-symbol support
- Data processing pipeline

✅ **WebSocket Server**

- Client connection management
- Symbol subscription system
- Real-time data broadcasting
- User authentication
- Order updates broadcasting
- Candle data subscription system

✅ **Trading Engine**

- In-memory order management
- Order matching logic
- Stop-loss and take-profit monitoring
- Balance management

✅ **User Management**

- Authentication system
- User portfolio tracking
- Balance management
- Trade history

✅ **Historical Data Management**

- TimescaleDB integration for efficient time-series storage
- Candle data aggregation to different timeframes
- Retention policies for optimal data management
- Continuous aggregates for optimized queries

✅ **API Documentation**

- Swagger UI for API endpoints
- WebSocket client example
- Comprehensive README documentation

## Technical Architecture

### Database Schema

The database uses PostgreSQL with TimescaleDB extension and Prisma ORM, including the following models:

- **User**: Stores user information and balances (USDC, BTC)
- **Symbol**: Trading pairs available on the platform
- **OHLCV**: Historical candlestick data for each symbol, optimized as a TimescaleDB hypertable
- **Order**: Historical record of executed orders

### WebSocket Communication

The platform uses a custom WebSocket protocol for real-time updates:

```typescript
// Client subscription message
{
  "type": "subscribe",
  "symbols": ["BTCUSDT", "ETHUSDT"]
}

// Server price update message
{
  "type": "price_update",
  "symbol": "BTCUSDT",
  "price": 45678.90,
  "timestamp": 1629483627000
}

// Candle subscription message
{
  "type": "SUBSCRIBE_CANDLES",
  "symbol": "btcusdt",
  "timeframe": "1m"
}

// Candle update message
{
  "type": "CANDLE_UPDATE",
  "data": {
    "symbol": "btcusdt",
    "timeframe": "1m",
    "candle": {
      "time": 1647352800,
      "open": 45000,
      "high": 45500,
      "low": 44800,
      "close": 45200,
      "volume": 1000
    }
  }
}

// Order placement message
{
  "type": "place_order",
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 0.01,
  "price": 45000,
  "stopLoss": 44000,
  "takeProfit": 48000
}
```

## Getting Started

### Prerequisites

- Bun (v1.0+)
- PostgreSQL 14+ with TimescaleDB extension
- Binance API key (for production)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   cd backend
   bun install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update database connection string
4. Initialize the database:
   ```
   bun run setup
   ```
   This will:
   - Generate Prisma client
   - Run database migrations
   - Initialize the database with seed data
   - Set up TimescaleDB for candle data
5. Start the development server:

   ```
   bun dev
   ```

   Or use the provided script:

   ```
   ./start.sh
   ```

### API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3001/api-docs
```

### WebSocket Client Example

A comprehensive WebSocket client example is available at:

```
http://localhost:3001/websocket-client-example.html
```

This example demonstrates:

- Real-time price updates
- User authentication
- Order placement and cancellation
- Portfolio tracking
- Stop-loss and take-profit functionality
- Candle data visualization

## Development Roadmap

### Phase 1: Core Infrastructure (Completed)

- ✅ WebSocket connections
- ✅ Data processing
- ✅ Basic UI

### Phase 2: Trading Engine (Completed)

- ✅ Order management system
- ✅ Price trigger monitoring
- ✅ Balance management

### Phase 3: User Experience (Completed)

- ✅ Authentication and user profiles
- ✅ Advanced charting
- ✅ Mobile responsiveness

### Phase 4: Historical Data Management (Completed)

- ✅ TimescaleDB integration
- ✅ Efficient candle data storage
- ✅ Time-series data aggregation
- ✅ Retention policies
- ✅ Continuous aggregates

### Phase 5: Advanced Features (Future)

- ⏳ Backtesting capabilities
- ⏳ Trading bots integration
- ⏳ Social trading features
- ⏳ Data compression for older candles
- ⏳ Redis caching for frequently accessed data
