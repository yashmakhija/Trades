# Trading App Backend - Core Documentation

This documentation provides an in-depth understanding of the Trading App backend system. The backend is a Node.js application built on Express with TypeScript that implements a simulated cryptocurrency trading platform with real-time price data from Binance.

## Documentation Index

1. [Architecture Overview](./architecture-overview.md) - High-level overview of the system architecture
2. [Data Model](./data-model.md) - Database schema and data structures
3. [Services](./services.md) - Core services that power the application
4. [API Endpoints](./api-endpoints.md) - REST API interface documentation
5. [Real-time Processing](./realtime-processing.md) - WebSocket and real-time data flow

## Key Features

- **Real-time Trading**: Connect to live market data and execute trades instantly
- **Order Management**: Place, track, and cancel orders with stop-loss and take-profit functionality
- **Balance Management**: Track user balances with reservation system for pending orders
- **WebSocket Communication**: Real-time data delivery to clients
- **Time-series Data**: Efficient storage and retrieval of OHLCV (candlestick) data
- **Analytics**: Trading performance metrics and historical analysis

## Technical Stack

- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL with TimescaleDB
- **ORM**: Prisma
- **Real-time Communication**: WebSocket (ws)
- **External Data**: Binance public WebSocket API
- **Authentication**: JWT (JSON Web Tokens)

## Core Concepts

### In-memory Order Management

Orders are tracked in-memory using efficient data structures to allow for:

- Fast lookup of orders by ID and user
- Quick access to stop-loss and take-profit orders by symbol
- Instant price-triggered execution

### Balance Reservation System

The balance system implements a reservation mechanism to ensure:

- Funds are securely allocated when orders are placed
- Balance updates are atomic and consistent
- Historical balance changes are tracked

### Event-Driven Architecture

The system follows an event-driven approach:

- Market data events trigger order checks
- Order execution events trigger balance updates
- Balance updates trigger client notifications

### Real-time Data Flow

Data flows through the system following this pattern:

1. Binance API → Binance Service → Order Manager
2. Order Manager → Balance Manager → WebSocket Service → Clients

## Development Considerations

When working with the codebase, keep in mind:

- All monetary values are stored as integers (100 = $1.00) to avoid floating-point issues
- In-memory state must always be synchronized with the database
- WebSocket connections need proper error handling and reconnection logic
- Performance is critical for real-time trading functionality

For more detailed information, explore the individual documentation sections linked above.

## Available Documentation

### Candle Data System

- [Candle Data System Architecture](candle-data-architecture.md) - Overview of the candle data system architecture
- [Timeframe Aggregation System](timeframe-aggregation-overview.md) - Technical details of how we aggregate candle data across timeframes
- [Timeframe Aggregation Implementation Guide](timeframe-aggregation.md) - Detailed implementation guide for developers

### Authentication

- [Authentication Flow](authentication-flow.md) - How authentication works in the platform

### Data Storage

- [TimescaleDB Integration](../timescaledb/README.md) - How we use TimescaleDB for time-series data

### API Documentation

- [API Overview](../api/README.md) - Overview of available API endpoints
