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

## Backend Architecture

The backend is built with:

- **Node.js & TypeScript**: For type-safe server-side code
- **Express**: Web server framework
- **WebSockets**: For real-time data streaming
- **Prisma**: Database ORM for PostgreSQL
- **Binance API**: For market data

### Key Components

#### 1. WebSocket Service

- Connects to Binance WebSocket API
- Forwards real-time market data to clients
- Handles client subscriptions to specific symbols
- Manages client connections and message broadcasting

#### 2. Data Processing

- Processes raw Binance data into usable formats
- Creates OHLCV candles from trade data
- Stores historical data in the database

#### 3. API Endpoints

- RESTful API for historical data
- Symbol information endpoints
- User management endpoints
- Swagger documentation

## Current Progress (60% Complete)

### Completed Features

✅ **Binance WebSocket Integration**

- Real-time connection to Binance
- Multi-symbol support
- Data processing pipeline

✅ **WebSocket Server**

- Client connection management
- Symbol subscription system
- Real-time data broadcasting

✅ **Data Storage**

- Database schema for symbols, OHLCV data
- Historical data retrieval

✅ **API Documentation**

- Swagger UI for API endpoints
- WebSocket client example

### In Progress / Remaining Work (40%)

#### Trading Engine (Hard)

The core trading functionality is still in development:

- **In-Memory Order Management**

  - Order book implementation
  - Order matching logic
  - Partial fills handling

- **Price Trigger System**

  - Stop-loss monitoring
  - Take-profit execution
  - Price gap handling

- **Balance Management**
  - Real-time balance updates
  - Reserved balance for open orders
  - Preventing double-spending

#### User Management

- Authentication system
- User portfolio tracking
- Position management
- Trade history

## Implementation Plan

### 1. In-Memory Order Manager

```typescript
class OrderManager {
  private openOrders: Map<string, Order[]> = new Map(); // orderId -> Order
  private userOrders: Map<string, Set<string>> = new Map(); // userId -> Set<orderId>
  private stopLossOrders: Map<string, Order[]> = new Map(); // symbol -> Orders with stop loss
  private takeProfitOrders: Map<string, Order[]> = new Map(); // symbol -> Orders with take profit

  // Methods for adding, removing, and matching orders
  addOrder(order: Order): string {
    /* ... */
  }
  cancelOrder(orderId: string): boolean {
    /* ... */
  }
  checkPriceTriggers(symbol: string, price: number): void {
    /* ... */
  }
  getUserOpenOrders(userId: string): Order[] {
    /* ... */
  }
}
```

### 2. Price Trigger Monitoring

```typescript
function monitorPriceTriggers(symbol: string, price: number): void {
  // Check stop loss orders
  const stopOrders = orderManager.getStopLossOrders(symbol);
  for (const order of stopOrders) {
    if (
      (order.isLong && price <= order.stopLoss) ||
      (!order.isLong && price >= order.stopLoss)
    ) {
      executeOrder(order, price, "STOP_LOSS");
    }
  }

  // Check take profit orders
  const tpOrders = orderManager.getTakeProfitOrders(symbol);
  for (const order of tpOrders) {
    if (
      (order.isLong && price >= order.takeProfit) ||
      (!order.isLong && price <= order.takeProfit)
    ) {
      executeOrder(order, price, "TAKE_PROFIT");
    }
  }
}
```

### 3. Balance Management System

```typescript
class BalanceManager {
  private balances: Map<string, UserBalance> = new Map(); // userId -> balance
  private reservedBalances: Map<string, Map<string, number>> = new Map(); // userId -> (orderId -> amount)

  // Check if user has enough available balance
  canPlaceOrder(userId: string, order: Order): boolean {
    /* ... */
  }

  // Reserve balance for an order
  reserveBalance(userId: string, orderId: string, amount: number): void {
    /* ... */
  }

  // Release reserved balance (for cancelled orders)
  releaseBalance(userId: string, orderId: string): void {
    /* ... */
  }

  // Update balance after order execution
  updateBalanceAfterExecution(
    userId: string,
    order: Order,
    executionPrice: number
  ): void {
    /* ... */
  }
}
```

## Technical Architecture

### Database Schema

The database uses PostgreSQL with Prisma ORM and includes the following models:

- **User**: Stores user information and balances (USDC, BTC)
- **Symbol**: Trading pairs available on the platform
- **OHLCV**: Historical candlestick data for each symbol
- **Trade**: Completed trades with PnL calculations
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

- Node.js (v16+)
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
   bun setup
   ```
5. Start the development server:
   ```
   bun dev
   ```

### API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3001/api-docs
```

### WebSocket Client Example

A simple WebSocket client example is available at:

```
http://localhost:3001/websocket-client-example.html
```

## Development Roadmap

### Phase 1: Core Infrastructure (Completed)

- ✅ WebSocket connections
- ✅ Data processing
- ✅ Basic UI

### Phase 2: Trading Engine (In Progress)

- ⏳ Order management system
- ⏳ Price trigger monitoring
- ⏳ Balance management

### Phase 3: User Experience

- ⏳ Authentication and user profiles
- ⏳ Advanced charting
- ⏳ Mobile responsiveness

### Phase 4: Advanced Features

- ⏳ Backtesting capabilities
- ⏳ Trading bots integration
- ⏳ Social trading features

