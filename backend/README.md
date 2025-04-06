# Trading App Backend

A robust trading application backend with FIX Protocol integration for direct market access.

## Features

- **FIX Protocol Integration**: Direct market access through Centroidsol's FIX Gateway
- **Real-time Market Data**: Live price updates via WebSocket
- **Order Management**: Place, modify, and cancel orders
- **Position Tracking**: Monitor trading positions and P&L
- **RESTful API**: Clean API endpoints for all trading operations
- **WebSocket Support**: Real-time updates for market data, orders, and positions

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with TimescaleDB
- **Caching**: Redis
- **FIX Protocol**: nodefix.js
- **WebSocket**: Socket.io
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6.0

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
4. Initialize the database:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:init
   ```

### Running the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## FIX Protocol Integration

The application integrates with Centroidsol's FIX Gateway for direct market access. It maintains two separate FIX sessions:

1. **Market Data Session**: For receiving real-time market data
2. **Trading Session**: For order management and position updates

### Configuration

FIX Protocol configuration is stored in `src/config/fix.config.ts`:

```typescript
export const fixConfig: FixConfig = {
  marketData: {
    host: "cntuk.centroidsol.com",
    port: 43510,
    senderCompID: "MD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    // ...
  },
  trading: {
    host: "cntuk.centroidsol.com",
    port: 43511,
    senderCompID: "TD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    // ...
  },
  // ...
};
```

### API Endpoints

#### Session Management

- `GET /api/fix/status` - Get FIX session status

#### Market Data

- `POST /api/fix/market-data/:symbol/subscribe` - Subscribe to market data
- `POST /api/fix/market-data/:symbol/unsubscribe` - Unsubscribe from market data

#### Order Management

- `POST /api/fix/orders` - Place new order
- `DELETE /api/fix/orders/:orderId/:clientOrderId` - Cancel order

#### Position Management

- `GET /api/fix/positions` - Get all positions
- `GET /api/fix/positions/:symbol` - Get position for symbol

### WebSocket Events

The application emits the following WebSocket events:

- `marketData` - Real-time market data updates
- `orderUpdate` - Order status changes
- `positionUpdate` - Position changes

## Architecture

The application follows a clean architecture with the following components:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Implement business logic and FIX Protocol integration
- **Routes**: Define API endpoints
- **Types**: TypeScript interfaces for type safety
- **Utils**: Utility functions and logging

## Testing

Run tests with:

```bash
npm test
```

## License

ISC
