# 100x Trading Platform API Documentation

## Overview

The 100x Trading Platform API provides a comprehensive set of endpoints for accessing real-time market data, managing user accounts, placing trades, and tracking portfolio performance. This document provides an overview of the API and instructions for using the interactive Swagger documentation.

## API Documentation

The API is fully documented using the OpenAPI 3.0 specification (formerly known as Swagger). You can access the interactive documentation in several ways:

1. **Swagger UI**: Visit `/api-docs` when the server is running to access the interactive Swagger UI.
2. **OpenAPI Specification**: Download the full OpenAPI specification at `/swagger.yaml`.
3. **JSON Format**: Access the specification in JSON format at `/api-docs.json`.

## Authentication

Most API endpoints require authentication using JWT (JSON Web Tokens). To authenticate:

1. Register a new user account using the `/api/auth/register` endpoint.
2. Log in using the `/api/auth/login` endpoint to obtain a JWT token.
3. Include the token in the `Authorization` header of your requests:
   ```
   Authorization: Bearer your-jwt-token
   ```

## API Endpoints

The API is organized into the following categories:

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate and get a JWT token
- `GET /api/auth/profile` - Get the authenticated user's profile

### Symbols

- `GET /api/symbols` - Get all trading symbols
- `GET /api/symbols/prices` - Get latest prices for all symbols
- `GET /api/symbols/{name}` - Get details for a specific symbol

### Orders

- `POST /api/orders` - Place a new order
- `GET /api/orders` - Get all orders for the authenticated user
- `DELETE /api/orders/{orderId}` - Cancel an existing order

### Portfolio

- `GET /api/orders/portfolio` - Get the authenticated user's portfolio

## WebSocket API

In addition to the REST API, the platform provides a WebSocket API for real-time updates. Connect to the WebSocket server at `ws://localhost:3001` (or the appropriate production URL).

### Authentication

After connecting, authenticate by sending:

```json
{
  "type": "AUTH",
  "token": "your-jwt-token"
}
```

### Subscribing to Symbols

Subscribe to updates for specific symbols:

```json
{
  "type": "SUBSCRIBE",
  "symbols": ["btcusdt", "ethusdt"]
}
```

### Message Types

The server will send various message types:

- `TICKER_UPDATE` - Real-time price updates
- `OHLCV_UPDATE` - Candlestick updates
- `ORDER_UPDATE` - Order status changes
- `BALANCE_UPDATE` - Account balance updates

## Advanced Trading Features

The API supports advanced trading features including:

- Market and limit orders
- Stop-loss and take-profit orders
- Short positions
- Real-time portfolio tracking

## Error Handling

All API endpoints use standard HTTP status codes and return detailed error messages in a consistent format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input parameters",
    "details": { ... }
  }
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage. If you exceed the rate limits, you'll receive a `429 Too Many Requests` response.

## Development and Testing

For development and testing purposes, you can use the provided endpoints without real funds. The API includes a sandbox mode that allows you to test all functionality without making actual trades.

## Support

If you encounter any issues or have questions about the API, please contact our support team at support@100xtrading.com.
