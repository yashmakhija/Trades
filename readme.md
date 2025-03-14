# Trading Platform

A real-time trading platform that connects to Binance for market data and allows users to trade cryptocurrencies with features like stop-loss and take-profit orders.

## Project Overview

This platform provides:

- Real-time market data from Binance
- Live price charts for multiple cryptocurrencies
- Trading capabilities with stop-loss and take-profit
- In-memory order management
- User balance tracking
- Historical data storage

## Recent Improvements

We've made several key improvements to the codebase to make it production-ready:

1. **Standardized Database Connections**: Implemented a singleton pattern for Prisma client to prevent connection pool exhaustion and improve performance.

2. **Enhanced Authentication**: Added JWT-based authentication with proper middleware for securing routes.

3. **Optimized Trading Engine**: Streamlined the order management system with efficient in-memory data structures.

4. **Code Cleanup**: Removed excessive comments and improved documentation for better maintainability.

5. **API Documentation**: Added comprehensive Swagger documentation for all endpoints.

6. **Comprehensive Testing**: Added extensive test suite covering all components and workflows.

## Testing

The platform includes a comprehensive test suite that covers all major components and workflows:

### Test Structure

- **Unit Tests**: Test individual components in isolation (auth, orders, symbols)
- **Service Tests**: Test service layer functionality (OrderManager, BalanceManager)
- **Integration Tests**: Test complete workflows across multiple components

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run a specific test file
bun test src/tests/auth.test.ts
```

### Test Coverage

The tests cover:

- Authentication flows
- Order management
- Symbol information
- Trading logic (stop-loss/take-profit)
- Balance management
- Complete trading workflows

## Areas to Focus On

The following areas require additional attention:

1. **Concurrency Management**: The trading engine needs robust concurrency handling to prevent race conditions during high-volume trading.

2. **Error Handling**: Implement more comprehensive error handling and recovery mechanisms throughout the application.

3. **Performance Testing**: Conduct load testing to ensure the system can handle production traffic volumes.

4. **Security Auditing**: Perform a thorough security audit, especially for authentication and order execution flows.

5. **Monitoring and Logging**: Enhance logging and add monitoring for critical system components.

## Most Challenging Components

During development, these components presented the greatest challenges:

1. **Price Trigger System**: Implementing an efficient system to monitor price changes and trigger stop-loss and take-profit orders required careful design to balance performance with accuracy.

2. **Balance Management**: Ensuring accurate tracking of user balances, especially during concurrent order executions, was complex and required a robust locking mechanism.

3. **WebSocket Connection Management**: Handling large numbers of concurrent WebSocket connections while maintaining low latency for price updates required optimization.

4. **Order Execution Logic**: Implementing the business logic for order execution, especially for short positions and calculating profit/loss correctly, required careful testing.

5. **Database Connection Pooling**: Standardizing the Prisma client usage across the application to prevent connection pool exhaustion was critical for stability.

## Backend Architecture

The backend is built with:

- **Node.js & TypeScript**: For type-safe server-side code
- **Express**: Web server framework
- **WebSockets**: For real-time data streaming
- **Prisma**: Database ORM for PostgreSQL
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

#### 2. Trading Engine

- In-memory order management
- Price trigger monitoring for stop-loss and take-profit
- Order matching and execution
- Balance management

#### 3. Data Processing

- Processes raw Binance data into usable formats
- Creates OHLCV candles from trade data
- Stores historical data in the database

#### 4. API Endpoints

- RESTful API for historical data
- Symbol information endpoints
- User management endpoints
- Order placement and cancellation
- Swagger documentation

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

✅ **API Documentation**

- Swagger UI for API endpoints
- WebSocket client example

## Technical Architecture

### Database Schema

The database uses PostgreSQL with Prisma ORM and includes the following models:

- **User**: Stores user information and balances (USDC, BTC)
- **Symbol**: Trading pairs available on the platform
- **OHLCV**: Historical candlestick data for each symbol
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

- Bun (v1.0+) or Node.js (v16+)
- PostgreSQL database
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
   bun run db:push
   ```
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

### Phase 4: Advanced Features (Future)

- ⏳ Backtesting capabilities
- ⏳ Trading bots integration
- ⏳ Social trading features
