# Trading App Backend

A Node.js backend for a trading application that connects to Binance WebSocket API to get real-time market data.

## Features

- Real-time market data from Binance WebSocket API
- PostgreSQL database with Prisma ORM
- RESTful API endpoints for symbols and prices
- WebSocket server for real-time updates to clients
- TypeScript for type safety
- Bun for fast runtime performance
- Swagger API documentation

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.0.0)
- PostgreSQL database (or use the provided Neon DB connection)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
cd backend
bun install
```

3. Set up environment variables:

   - Copy `.env.example` to `.env` (if not already done)
   - Update the `DATABASE_URL` if needed

4. Run the setup script to initialize the database:

```bash
bun setup
```

This will:

- Generate the Prisma client
- Push the database schema
- Initialize the database with trading symbols

### Running the Application

Development mode with hot reload:

```bash
bun dev
```

Production mode:

```bash
bun start
```

## Troubleshooting

### Symbol Not Found Errors

If you see errors like `Symbol btcusdt not found in database` in the logs, it means the symbols haven't been initialized in the database before the WebSocket connection starts processing data.

To fix this issue, run:

```bash
./fix.sh
```

This script will:

1. Stop any running processes
2. Generate the Prisma client
3. Push the schema to the database
4. Initialize the database with symbols
5. Start the application

Alternatively, you can run the setup steps manually:

```bash
bun db:generate
bun db:push
bun db:init
bun dev
```

## API Documentation

The API is documented using OpenAPI (Swagger). You can access the documentation at:

```
http://localhost:3001/api-docs
```

## API Endpoints

### Symbols

- `GET /api/symbols` - Get all available trading symbols
- `GET /api/symbols/prices` - Get latest prices for all symbols
- `GET /api/symbols/:name` - Get details for a specific symbol

## WebSocket API

The application provides a WebSocket server for real-time updates. Connect to:

```
ws://localhost:3001
```

### WebSocket Messages

#### Server to Client

1. **INITIAL_DATA** - Sent when a client connects

   ```json
   {
     "type": "INITIAL_DATA",
     "data": {
       "btcusdt": {
         "symbol": "btcusdt",
         "price": 65432.1,
         "priceChangePercent": 2.5,
         "volume": 1234.56,
         "timestamp": 1647352800000
       }
       // Other symbols...
     }
   }
   ```

2. **TICKER_UPDATE** - Real-time price updates

   ```json
   {
     "type": "TICKER_UPDATE",
     "symbol": "btcusdt",
     "data": {
       "symbol": "btcusdt",
       "price": 65500.25,
       "priceChangePercent": 2.7,
       "volume": 1240.56,
       "timestamp": 1647352860000
     }
   }
   ```

3. **OHLCV_UPDATE** - Candlestick data updates
   ```json
   {
     "type": "OHLCV_UPDATE",
     "symbol": "btcusdt",
     "data": {
       "id": "123e4567-e89b-12d3-a456-426614174000",
       "symbol": "btcusdt",
       "open": 65000.0,
       "high": 65500.0,
       "low": 64800.0,
       "close": 65200.0,
       "volume": 123.45,
       "timestamp": "2023-03-15T12:00:00Z"
     }
   }
   ```

#### Client to Server

1. **SUBSCRIBE** - Subscribe to updates for a specific symbol
   ```json
   {
     "type": "SUBSCRIBE",
     "symbol": "btcusdt"
   }
   ```

## WebSocket Example

A simple WebSocket client example is available at:

```
http://localhost:3001/websocket-client-example.html
```

## Database Schema

The database schema includes:

- `User` - User information and balance
- `Symbol` - Trading symbols with current prices
- `Order` - Trading orders with status
- `Position` - User positions
- `OHLCV` - Historical price data

## Configuration

Configuration is managed through environment variables in the `.env` file:

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development, production, test)
- `DATABASE_URL` - PostgreSQL connection string
- `BINANCE_WEBSOCKET_URL` - Binance WebSocket URL
- `TRADING_SYMBOLS` - Comma-separated list of trading symbols to track

## License

MIT
