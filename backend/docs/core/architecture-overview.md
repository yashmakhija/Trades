# Backend Architecture Overview

## Core Components

The Trading App backend is a Node.js application built with Express, Prisma ORM, PostgreSQL with TimescaleDB, and WebSockets. The architecture follows a modular structure separated into several key components:

### Server & Entry Point

- **server.ts**: Initializes and manages the HTTP server, sets up WebSocket connections, and handles graceful shutdown.
- **index.ts**: Entry point that configures Express middleware, initializes routes, and starts the server.

### Data Layer

- **Prisma ORM**: Manages database interactions with PostgreSQL/TimescaleDB.
- **Schema**: Defines models for Users, Symbols, Orders, OHLCV (candlestick) data, and Balance history.

### API Layer

- **Routes**: Define API endpoints for symbols, authentication, orders, candles, analytics, and balance operations.
- **Controllers**: Implement the business logic for each API endpoint, handling requests and responses.
- **Middlewares**: Process requests before they reach the route handlers (authentication, validation, etc.).

### Service Layer

- **Order Manager**: Handles in-memory order management, tracks open orders, stop-loss and take-profit conditions.
- **Balance Manager**: Manages user balances, reserving and releasing funds for orders.
- **Binance Service**: Connects to Binance WebSocket API to receive real-time market data.
- **WebSocket Service**: Manages real-time communication with clients, broadcasting market data and order updates.
- **Candle Service**: Processes and stores OHLCV (candlestick) data for chart display.
- **Trade Analytics Service**: Processes trade data to generate metrics and insights.

### Real-time Features

- **WebSocket Communication**: Two-way real-time communication with frontend clients.
- **Market Data Streaming**: Real-time price updates from Binance.
- **Order Execution**: Orders are executed based on market price movements.
- **User Notifications**: Balance updates, order status changes, etc.

## Data Flow

1. **Market Data Inflow**: Real-time data from Binance WebSocket is processed and stored.
2. **Order Placement**: Users place orders via the REST API, funds are reserved from their balance.
3. **Order Execution**: The Order Manager monitors price movements to execute stop-loss and take-profit orders.
4. **Balance Updates**: The Balance Manager adjusts user balances after order execution.
5. **Notifications**: Updates are broadcast to clients via WebSockets (prices, orders, balances).

## Technical Features

- **High-Performance Time-Series Data**: TimescaleDB for efficient storage of OHLCV data.
- **Real-time Processing**: In-memory order and balance tracking for fast execution.
- **Scalable Architecture**: Separation of concerns allows for horizontal scaling.
- **Graceful Shutdown**: Proper handling of termination signals to prevent data loss.
