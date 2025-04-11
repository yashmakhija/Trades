# FIX Protocol Configuration Guide

## Overview

This document provides detailed configuration instructions for setting up the FIX protocol implementation.

## QuickFIX Configuration

### 1. Session Configuration

```ini
[DEFAULT]
ConnectionType=initiator
ReconnectInterval=60
FileStorePath=./store
FileLogPath=./log
StartTime=00:00:00
EndTime=23:59:59
UseDataDictionary=Y
DataDictionary=FIX44.xml
ValidateUserDefinedFields=N
ValidateIncomingMessage=N

[SESSION]
BeginString=FIX.4.4
SenderCompID=YOUR_SENDER_ID
TargetCompID=BINANCE
HeartBtInt=30
SocketConnectHost=stream.binance.com
SocketConnectPort=9443
```

### 2. Environment Variables

```env
# FIX Protocol Configuration
FIX_SENDER_COMP_ID=your_sender_id
FIX_TARGET_COMP_ID=BINANCE
FIX_SOCKET_HOST=stream.binance.com
FIX_SOCKET_PORT=9443
FIX_HEARTBEAT_INTERVAL=30
FIX_RECONNECT_INTERVAL=60

# Security
FIX_API_KEY=your_api_key
FIX_API_SECRET=your_api_secret
FIX_SSL_ENABLED=true

# Logging
FIX_LOG_LEVEL=info
FIX_LOG_PATH=./logs/fix
```

## Application Configuration

### 1. FIX Service Configuration

```typescript
// config/fix.config.ts
export const fixConfig = {
  connection: {
    host: process.env.FIX_SOCKET_HOST,
    port: parseInt(process.env.FIX_SOCKET_PORT),
    ssl: process.env.FIX_SSL_ENABLED === "true",
  },
  session: {
    senderCompId: process.env.FIX_SENDER_COMP_ID,
    targetCompId: process.env.FIX_TARGET_COMP_ID,
    heartbeatInterval: parseInt(process.env.FIX_HEARTBEAT_INTERVAL),
    reconnectInterval: parseInt(process.env.FIX_RECONNECT_INTERVAL),
  },
  trading: {
    defaultOrderType: "LIMIT",
    defaultTimeInForce: "GTC",
    maxRetries: 3,
  },
  security: {
    apiKey: process.env.FIX_API_KEY,
    apiSecret: process.env.FIX_API_SECRET,
  },
  logging: {
    level: process.env.FIX_LOG_LEVEL,
    path: process.env.FIX_LOG_PATH,
  },
};
```

### 2. Market Data Configuration

```typescript
// config/market-data.config.ts
export const marketDataConfig = {
  updateInterval: 1000, // ms
  batchSize: 100,
  symbols: {
    default: ["BTCUSDT", "ETHUSDT"],
    updateInterval: 60000, // ms
  },
  cache: {
    ttl: 60, // seconds
    maxSize: 1000,
  },
};
```

### 3. Order Management Configuration

```typescript
// config/order.config.ts
export const orderConfig = {
  maxOrdersPerSymbol: 100,
  orderTimeout: 30000, // ms
  retryInterval: 5000, // ms
  maxRetries: 3,
  validation: {
    minQuantity: 0.001,
    maxQuantity: 100,
    minPrice: 0.00001,
    maxPrice: 1000000,
  },
};
```

## Docker Configuration

### 1. Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy FIX configuration
COPY config/FIX44.xml ./config/
COPY config/quickfix.cfg ./config/

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

### 2. Docker Compose

```yaml
version: "3.8"

services:
  trading-app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
      - ./store:/app/store
    environment:
      - NODE_ENV=production
      - FIX_SENDER_COMP_ID=${FIX_SENDER_COMP_ID}
      - FIX_TARGET_COMP_ID=${FIX_TARGET_COMP_ID}
      - FIX_API_KEY=${FIX_API_KEY}
      - FIX_API_SECRET=${FIX_API_SECRET}
    depends_on:
      - redis
      - timescaledb

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  timescaledb:
    image: timescale/timescaledb:latest-pg14
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - timescaledb-data:/var/lib/postgresql/data

volumes:
  redis-data:
  timescaledb-data:
```

## Health Checks

### 1. FIX Connection Health Check

```typescript
// health/fix.health.ts
export async function checkFixHealth(): Promise<boolean> {
  try {
    const fixService = FixService.getInstance();
    return fixService.isConnected();
  } catch (error) {
    logger.error("FIX health check failed:", error);
    return false;
  }
}
```

### 2. Market Data Health Check

```typescript
// health/market-data.health.ts
export async function checkMarketDataHealth(): Promise<boolean> {
  try {
    const redis = RedisService.getInstance();
    const latestData = await redis.get("latest_market_data");
    return !!latestData;
  } catch (error) {
    logger.error("Market data health check failed:", error);
    return false;
  }
}
```

## Monitoring Configuration

### 1. Prometheus Metrics

```typescript
// monitoring/metrics.ts
import { Registry, Counter, Gauge } from "prom-client";

const registry = new Registry();

export const fixMetrics = {
  messagesReceived: new Counter({
    name: "fix_messages_received_total",
    help: "Total number of FIX messages received",
    labelNames: ["messageType"],
  }),
  messagesSent: new Counter({
    name: "fix_messages_sent_total",
    help: "Total number of FIX messages sent",
    labelNames: ["messageType"],
  }),
  connectionStatus: new Gauge({
    name: "fix_connection_status",
    help: "Current FIX connection status (1=connected, 0=disconnected)",
  }),
};

registry.registerMetric(fixMetrics.messagesReceived);
registry.registerMetric(fixMetrics.messagesSent);
registry.registerMetric(fixMetrics.connectionStatus);
```

### 2. Logging Configuration

```typescript
// logging/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.FIX_LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: `${process.env.FIX_LOG_PATH}/error.log`,
      level: "error",
    }),
    new winston.transports.File({
      filename: `${process.env.FIX_LOG_PATH}/combined.log`,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
```

## Security Configuration

### 1. SSL/TLS Configuration

```typescript
// security/ssl.config.ts
export const sslConfig = {
  enabled: process.env.FIX_SSL_ENABLED === "true",
  cert: process.env.FIX_SSL_CERT,
  key: process.env.FIX_SSL_KEY,
  ca: process.env.FIX_SSL_CA,
  rejectUnauthorized: process.env.FIX_SSL_REJECT_UNAUTHORIZED === "true",
};
```

### 2. Authentication Configuration

```typescript
// security/auth.config.ts
export const authConfig = {
  apiKey: process.env.FIX_API_KEY,
  apiSecret: process.env.FIX_API_SECRET,
  sessionTimeout: 3600000, // 1 hour
  maxFailedAttempts: 3,
  lockoutDuration: 300000, // 5 minutes
};
```

## Deployment Checklist

1. Environment Setup

   - [ ] Configure all required environment variables
   - [ ] Set up SSL certificates
   - [ ] Configure logging directories
   - [ ] Set up monitoring endpoints

2. Database Setup

   - [ ] Initialize TimescaleDB
   - [ ] Set up Redis
   - [ ] Configure connection pools

3. FIX Protocol Setup

   - [ ] Configure QuickFIX session
   - [ ] Set up message store
   - [ ] Configure logging
   - [ ] Test connection

4. Security Setup

   - [ ] Configure SSL/TLS
   - [ ] Set up API keys
   - [ ] Configure firewall rules
   - [ ] Set up monitoring

5. Monitoring Setup

   - [ ] Configure Prometheus metrics
   - [ ] Set up Grafana dashboards
   - [ ] Configure alerts
   - [ ] Test monitoring

6. Testing

   - [ ] Run unit tests
   - [ ] Run integration tests
   - [ ] Test with Binance FIX API
   - [ ] Verify monitoring

7. Deployment
   - [ ] Build Docker image
   - [ ] Deploy to staging
   - [ ] Run smoke tests
   - [ ] Deploy to production
