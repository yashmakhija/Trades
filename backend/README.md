# Trading App Backend

This is the backend for the Trading App, a platform for simulating cryptocurrency trading with real-time market data.

## Features

- Real-time market data via WebSocket
- User authentication and account management
- Order management (market, limit, stop-loss, take-profit)
- Historical candle data with TimescaleDB integration
- RESTful API with Swagger documentation
- Trade Analytics:
  - Trade history with pagination and filtering
  - User trading statistics (win rate, PnL, etc.)
  - Per-symbol trading statistics
  - Daily PnL tracking
  - Real-time analytics updates via WebSocket
- Advanced Balance Management:
  - Real-time balance tracking with WebSocket updates
  - Reserved balance for open orders
  - Balance history with transaction types
  - Dynamic PnL calculation for open positions
  - Real-time unrealized PnL updates
  - Automatic balance adjustments on order execution

## Balance System

The platform includes a sophisticated balance management system:

### Features

1. **Real-time Balance Tracking**

   - Live updates of total, available, and reserved balance
   - Automatic updates based on position values
   - Real-time unrealized PnL calculation
   - WebSocket notifications for balance changes

2. **Balance Reservation**

   - Automatic balance reservation for open orders
   - Reserved amount = Quantity × Current Price
   - Real-time updates as market prices change
   - Automatic release on order cancellation

3. **Balance History**

   - Detailed transaction history
   - Multiple transaction types (DEPOSIT, WITHDRAWAL, TRADE, FUNDING)
   - Pagination and date filtering
   - Order reference for trade-related transactions

4. **Position Value Tracking**
   - Real-time position value updates
   - Automatic PnL calculation
   - Support for both long and short positions
   - Aggregated portfolio value calculation

### Example WebSocket Messages

```typescript
// Balance Update Message
{
  "type": "BALANCE_UPDATE",
  "data": {
    "total": 10000.00,      // Total balance including position values
    "available": 8500.00,   // Available for new trades
    "reserved": 1500.00,    // Reserved for open orders
    "unrealizedPnL": 250.00 // Current profit/loss from open positions
  }
}

// Position Update Message
{
  "type": "POSITION_UPDATE",
  "data": {
    "symbol": "BTCUSDT",
    "entryPrice": 45000.00,
    "currentPrice": 46000.00,
    "quantity": 0.1,
    "value": 4600.00,
    "unrealizedPnL": 100.00,
    "pnlPercentage": 2.22
  }
}
```

### API Endpoints

```typescript
// Get current balance
GET /api/balance

// Get balance history
GET /api/balance/history?page=1&limit=50&startDate=2024-03-01&endDate=2024-03-16

// Get reserved balance details
GET /api/balance/reserved
```

## Tech Stack

- **Node.js & TypeScript**: For type-safe server-side code
- **Express**: Web server framework
- **WebSockets**: For real-time data streaming
- **Prisma**: Database ORM for PostgreSQL
- **TimescaleDB**: For efficient time-series data storage
- **Binance API**: For market data
- **Bun**: Fast JavaScript runtime and package manager (v1.0+)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+ with TimescaleDB extension
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   # or
   bun install
   ```
3. Set up environment variables:

   ```
   cp .env.example .env
   ```

   Edit the `.env` file with your database credentials and other settings.

4. Set up the database:

   ```
   npm run setup
   # or
   bun run setup
   ```

   This will:

   - Generate Prisma client
   - Run database migrations
   - Initialize the database with seed data
   - Check if TimescaleDB is available

5. Set up TimescaleDB (if available):
   ```
   npm run db:timescale
   # or
   bun run db:timescale
   ```
   This will:
   - Enable the TimescaleDB extension
   - Convert the OHLCV table to a hypertable
   - Create indexes for better query performance

### Development

Start the development server:

```
npm run dev
# or
bun dev
```

The server will start on port 3001 (or the port specified in your `.env` file).

### Production

Build the project:

```
npm run build
# or
bun run build
```

Start the production server:

```
npm start
# or
bun start
```

## API Documentation

API documentation is available at `/api-docs` when the server is running. The API includes:

- **Authentication**: User registration, login, and profile management
- **Symbols**: Market data and price information
- **Orders**: Order placement and management
- **Portfolio**: Balance and position tracking
- **Candles**: Historical and real-time price data
- **Analytics**: Trade history and performance metrics
- **WebSocket**: Real-time data streaming including:
  - Price updates
  - Order status changes
  - Balance updates
  - Trade analytics updates

For detailed documentation, see:

- [API Documentation](./docs/api/README.md)
- [WebSocket Guide](./docs/api/websocket.md)
- [Analytics Guide](./docs/features/analytics.md)

## Project Structure

```
backend/
├── docs/                  # Documentation files
│   ├── api/               # API documentation
│   ├── features/          # Feature-specific documentation
│   └── timescaledb/       # TimescaleDB documentation
├── prisma/                # Prisma schema and migrations
├── scripts/               # Setup and utility scripts
│   └── timescaledb/       # TimescaleDB setup scripts
├── src/
│   ├── config/            # Configuration files
│   ├── controllers/       # API controllers
│   ├── lib/               # Shared libraries
│   ├── middlewares/       # Express middlewares
│   ├── public/            # Static files
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── index.ts           # Application entry point
│   └── server.ts          # Server setup
└── tests/                 # Test files
```

## Documentation

The project includes comprehensive documentation:

- [API Documentation](./docs/api/README.md): REST API endpoints and WebSocket API
- [Candle Data System](./docs/features/candle-data.md): Candle data management system
- [TimescaleDB Implementation](./docs/timescaledb/README.md): TimescaleDB setup and usage

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
