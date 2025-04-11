# FIX Protocol Implementation

This document outlines the FIX protocol implementation for the trading application.

## Overview

The Financial Information eXchange (FIX) protocol is implemented to handle both market data and trading operations. The implementation uses QuickFIX/J for Node.js to manage FIX connections and message handling.

## Connection Details

### Pricing Connection

- **IP/DNS**: cntuk.centroidsol.com
- **Port**: 43510
- **Login Username**: xxx
- **Login Password**: xxx
- **SenderCompID**: MD_FX_Squad
- **TargetCompID**: CENTROID_SOL
- **SSL**: No
- **ResetOnLogon**: Yes
- **Session**: Friday:00:00:00-Friday:00:00:00

### Trading Connection

- **IP/DNS**: cntuk.centroidsol.com
- **Port**: 43511
- **Login Username**: xxx
- **Login Password**: xxx
- **SenderCompID**: TD_FX_Squad
- **TargetCompID**: CENTROID_SOL
- **SSL**: Yes
- **ResetOnLogon**: No
- **Session**: Friday:00:00:00-Friday:00:00:00

## Directory Structure

```
src/
├── services/
│   └── fix/
│       ├── config/
│       │   └── fix.config.ts
│       ├── handlers/
│       │   ├── MarketDataHandler.ts
│       │   └── TradingHandler.ts
│       ├── utils/
│       │   ├── FixMessageUtils.ts
│       │   └── FixLogger.ts
│       └── FixService.ts
└── types/
    └── fix/
        └── config.ts
```

## Components

### 1. FixService

The main service class that manages FIX connections and message routing.

### 2. MarketDataHandler

Handles market data messages and updates.

### 3. TradingHandler

Manages order-related messages and execution reports.

### 4. FixMessageUtils

Utility functions for FIX message formatting and parsing.

### 5. FixLogger

Specialized logging for FIX-related events and messages.

## Implementation Notes

### Connection Management

- Automatic reconnection with configurable attempts and intervals
- Session management for both pricing and trading connections
- Heartbeat monitoring and connection health checks

### Message Handling

- Support for market data requests and responses
- Order management (New Order Single, Order Cancel Request)
- Execution reports and order status updates

### Error Handling

- Comprehensive error logging
- Connection failure recovery
- Message validation and error reporting

### Performance Considerations

- Message batching for high-volume scenarios
- Efficient message parsing and formatting
- Optimized logging with rotation

## Usage

### Initialize FIX Service

```typescript
import { FixService } from "./services/fix/FixService";

const fixService = new FixService();
await fixService.initialize();
```

### Subscribe to Market Data

```typescript
const marketDataHandler = new MarketDataHandler();
marketDataHandler.on("marketDataUpdate", (data) => {
  console.log("Market data update:", data);
});
```

### Place Orders

```typescript
const tradingHandler = new TradingHandler();
tradingHandler.on("orderUpdate", (order) => {
  console.log("Order update:", order);
});

const order = {
  symbol: "EURUSD",
  side: "BUY",
  type: "LIMIT",
  quantity: 100000,
  price: 1.1,
};

await fixService.sendMessage(
  "trading",
  FixMessageUtils.createNewOrderSingle(order)
);
```

## Configuration

### Environment Variables

```env
FIX_PRICING_USERNAME=xxx
FIX_PRICING_PASSWORD=xxx
FIX_TRADING_USERNAME=xxx
FIX_TRADING_PASSWORD=xxx
FIX_LOG_LEVEL=info
```

### Logging

Logs are stored in the `logs/fix` directory with the following files:

- `error.log`: Error-level messages
- `combined.log`: All log messages
- `messages.log`: Detailed FIX message logs

## Troubleshooting

### Common Issues

1. Connection Refused

   - Verify server status and port availability
   - Check firewall settings
   - Ensure correct IP whitelisting

2. High Latency

   - Use UK-based LD4 server
   - Monitor network performance
   - Implement connection pooling

3. Message Processing Errors
   - Check message format
   - Verify sequence numbers
   - Monitor message validation

## Testing

### Unit Tests

```bash
npm run test
```

### Integration Tests

```bash
npm run test:integration
```

## Monitoring

### Health Checks

```typescript
const isPricingConnected = fixService.isConnected("pricing");
const isTradingConnected = fixService.isConnected("trading");
```

### Metrics

- Connection status
- Message counts
- Error rates
- Latency measurements

## Security

### SSL/TLS

- Trading connection uses SSL
- Certificate management
- Secure key exchange

### Authentication

- Username/password authentication
- Session management
- Access control

## Future Improvements

1. Message Compression
2. Advanced Order Types
3. Position Management
4. Risk Controls
5. Performance Optimization
