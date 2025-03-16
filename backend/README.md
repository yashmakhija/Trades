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

## Tech Stack

- Node.js with TypeScript
- Express.js for API routes
- PostgreSQL with Prisma ORM
- TimescaleDB for time-series data
- WebSocket for real-time communication

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
