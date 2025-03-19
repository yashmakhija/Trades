# API Endpoints

The backend exposes several RESTful API endpoints for interacting with the trading system. Here's a comprehensive overview of the available endpoints and their functionality.

## API Routes Structure

The API follows a structured organization with routes grouped by functionality:

```typescript
// Route initialization
app.use("/api/symbols", symbolRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/candles", candleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/balance", balanceRoutes);
```

## Authentication Endpoints

**Base path:** `/api/auth`

| Endpoint    | Method | Description                       | Authentication |
| ----------- | ------ | --------------------------------- | -------------- |
| `/register` | POST   | Register a new user               | No             |
| `/login`    | POST   | Authenticate and obtain JWT token | No             |

### Authentication Logic

The authentication system uses JSON Web Tokens (JWT) for maintaining stateless authentication:

1. User registers with email and password (password is hashed before storage)
2. User logs in with credentials and receives a JWT token
3. JWT token is sent with subsequent requests in the Authorization header
4. Token is verified by authentication middleware for protected routes

## Order Endpoints

**Base path:** `/api/orders`

| Endpoint     | Method | Description                | Authentication |
| ------------ | ------ | -------------------------- | -------------- |
| `/`          | POST   | Place a new order          | Yes            |
| `/`          | GET    | Get all user orders        | Yes            |
| `/:orderId`  | DELETE | Cancel an order            | Yes            |
| `/portfolio` | GET    | Get user portfolio summary | Yes            |

### Order Placement Logic

The order placement endpoint (`POST /api/orders`) handles:

1. Validating order parameters (symbol, type, price, quantity)
2. Checking user balance sufficiency
3. Reserving balance for the order
4. Creating the order in the database
5. Adding the order to in-memory order tracking
6. Broadcasting order updates via WebSocket

## Symbol Endpoints

**Base path:** `/api/symbols`

| Endpoint     | Method | Description                             | Authentication |
| ------------ | ------ | --------------------------------------- | -------------- |
| `/`          | GET    | Get all available trading symbols       | No             |
| `/:id`       | GET    | Get details for a specific symbol       | No             |
| `/prices`    | GET    | Get current prices for all symbols      | No             |
| `/:id/price` | GET    | Get current price for a specific symbol | No             |

## Candle Endpoints

**Base path:** `/api/candles`

| Endpoint                     | Method | Description                                     | Authentication |
| ---------------------------- | ------ | ----------------------------------------------- | -------------- |
| `/:symbol/:timeframe`        | GET    | Get candlestick data for a symbol and timeframe | No             |
| `/:symbol/:timeframe/latest` | GET    | Get latest candle for a symbol and timeframe    | No             |

### Candle Data Parameters

The candle endpoints support the following query parameters:

- `limit`: Number of candles to return (default: 100)
- `startTime`: Filter candles starting from this timestamp
- `endTime`: Filter candles up to this timestamp

## Analytics Endpoints

**Base path:** `/api/analytics`

| Endpoint            | Method | Description                            | Authentication |
| ------------------- | ------ | -------------------------------------- | -------------- |
| `/trade-stats`      | GET    | Get user trading statistics            | Yes            |
| `/trade-history`    | GET    | Get user trading history               | Yes            |
| `/profit-by-day`    | GET    | Get user profit/loss grouped by day    | Yes            |
| `/profit-by-symbol` | GET    | Get user profit/loss grouped by symbol | Yes            |
| `/win-rate`         | GET    | Get user win/loss ratio                | Yes            |

## Balance Endpoints

**Base path:** `/api/balance`

| Endpoint    | Method | Description                          | Authentication |
| ----------- | ------ | ------------------------------------ | -------------- |
| `/`         | GET    | Get user balance information         | Yes            |
| `/history`  | GET    | Get user balance history             | Yes            |
| `/deposit`  | POST   | Add funds to user account (for demo) | Yes            |
| `/withdraw` | POST   | Withdraw funds from user account     | Yes            |

## Other Endpoints

| Endpoint         | Method | Description                | Authentication |
| ---------------- | ------ | -------------------------- | -------------- |
| `/health`        | GET    | Health check endpoint      | No             |
| `/api-docs`      | GET    | Swagger UI documentation   | No             |
| `/api-docs.json` | GET    | Swagger JSON specification | No             |

## WebSocket Connections

While not a REST endpoint, the application also provides a WebSocket connection:

**WebSocket Path:** `/ws`

Clients can connect to this endpoint to receive real-time updates on:

- Price changes
- Order updates
- Balance updates
- Candlestick data

WebSocket connections support authentication via JWT token and include a subscription system for clients to specify which data they want to receive.
