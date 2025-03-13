# Trading App Backend

A Node.js backend for a trading application that connects to Binance WebSocket API to get real-time market data.

## Features

- Real-time market data from Binance WebSocket API
- PostgreSQL database with Prisma ORM
- RESTful API endpoints for symbols and prices
- TypeScript for type safety
- Bun for fast runtime performance

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

4. Generate Prisma client:

```bash
bun db:generate
```

5. Push the database schema:

```bash
bun db:push
```

### Running the Application

Development mode with hot reload:

```bash
bun dev
```

Production mode:

```bash
bun start
```

## API Endpoints

### Symbols

- `GET /api/symbols` - Get all available trading symbols
- `GET /api/symbols/prices` - Get latest prices for all symbols
- `GET /api/symbols/:name` - Get details for a specific symbol

## WebSocket Data

The application connects to Binance WebSocket API to get real-time market data for the configured trading symbols. The data is stored in both:

1. In-memory cache for fast access
2. PostgreSQL database (updated periodically to avoid excessive writes)

## Database Schema

The database schema includes:

- `User` - User information and balance
- `Symbol` - Trading symbols with current prices
- `Order` - Trading orders with status

## Configuration

Configuration is managed through environment variables in the `.env` file:

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development, production, test)
- `DATABASE_URL` - PostgreSQL connection string
- `BINANCE_WEBSOCKET_URL` - Binance WebSocket URL
- `TRADING_SYMBOLS` - Comma-separated list of trading symbols to track

## License

MIT
