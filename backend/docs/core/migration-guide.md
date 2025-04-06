# Migration Guide: Transitioning to FIX Protocol and Alpha Vantage

## Overview

This guide outlines the step-by-step process for migrating from the current trading system to the new architecture using FIX Protocol and Alpha Vantage.

## Phase 1: Preparation

### 1. Environment Setup

```bash
# Install new dependencies
npm install nodefix axios ioredis

# Update environment variables
FIX_HOST=your.fix.gateway
FIX_PORT=5001
FIX_SENDER_ID=your_sender_id
FIX_TARGET_ID=your_target_id
ALPHA_VANTAGE_API_KEY=your_api_key
```

### 2. Database Updates

```sql
-- Add new tables for FIX Protocol
CREATE TABLE fix_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fix_messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    message_type VARCHAR(10) NOT NULL,
    message_content TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new tables for Alpha Vantage data
CREATE TABLE market_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume BIGINT NOT NULL,
    source VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE technical_indicators (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    indicator VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    value DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Phase 2: Implementation

### 1. FIX Protocol Integration

```typescript
// src/services/fix/index.ts
import { FixConnection } from "nodefix";
import { FixSessionManager } from "./fixSession";
import { FixOrderManager } from "./orderManager";
import { FixMarketDataService } from "./marketData";

export class FixService {
  private session: FixSessionManager;
  private orderManager: FixOrderManager;
  private marketData: FixMarketDataService;

  constructor(config: FixConfig) {
    this.session = new FixSessionManager(config);
    this.orderManager = new FixOrderManager(this.session);
    this.marketData = new FixMarketDataService(this.session);
  }

  async initialize(): Promise<void> {
    await this.session.connect();
    await this.setupEventHandlers();
  }

  private async setupEventHandlers(): Promise<void> {
    this.session.on("message", this.handleMessage);
    this.session.on("error", this.handleError);
  }
}
```

### 2. Alpha Vantage Integration

```typescript
// src/services/alphaVantage/index.ts
import { AlphaVantageMarketDataService } from "./marketData";
import { TechnicalIndicatorsService } from "./technicalIndicators";
import { FundamentalDataService } from "./fundamentalData";

export class AlphaVantageService {
  private marketData: AlphaVantageMarketDataService;
  private technicalIndicators: TechnicalIndicatorsService;
  private fundamentalData: FundamentalDataService;

  constructor(config: AlphaVantageConfig) {
    this.marketData = new AlphaVantageMarketDataService(config.apiKey);
    this.technicalIndicators = new TechnicalIndicatorsService(config.apiKey);
    this.fundamentalData = new FundamentalDataService(config.apiKey);
  }
}
```

### 3. Data Synchronization

```typescript
// src/services/sync/index.ts
import { DataSyncService } from "./dataSync";
import { FixService } from "../fix";
import { AlphaVantageService } from "../alphaVantage";

export class SyncService {
  private dataSync: DataSyncService;
  private fix: FixService;
  private alphaVantage: AlphaVantageService;

  constructor(
    fix: FixService,
    alphaVantage: AlphaVantageService,
    dataSync: DataSyncService
  ) {
    this.fix = fix;
    this.alphaVantage = alphaVantage;
    this.dataSync = dataSync;
  }

  async syncData(): Promise<void> {
    // Sync historical data
    // Sync real-time data
    // Update technical indicators
  }
}
```

## Phase 3: Testing

### 1. Unit Tests

```typescript
// src/tests/fix/unit.test.ts
describe("FIX Protocol Unit Tests", () => {
  let fixService: FixService;

  beforeEach(() => {
    fixService = new FixService(mockConfig);
  });

  test("should connect to FIX gateway", async () => {
    await expect(fixService.initialize()).resolves.not.toThrow();
  });
});
```

### 2. Integration Tests

```typescript
// src/tests/integration/trading.test.ts
describe("Trading Integration Tests", () => {
  let tradingService: TradingService;

  beforeEach(async () => {
    tradingService = await setupTradingService();
  });

  test("should execute order through FIX", async () => {
    const order = createTestOrder();
    const result = await tradingService.executeOrder(order);
    expect(result.status).toBe("FILLED");
  });
});
```

## Phase 4: Deployment

### 1. Configuration Updates

```yaml
# docker-compose.yml
version: "3.8"
services:
  app:
    build: .
    environment:
      - FIX_HOST=${FIX_HOST}
      - FIX_PORT=${FIX_PORT}
      - ALPHA_VANTAGE_API_KEY=${ALPHA_VANTAGE_API_KEY}
    depends_on:
      - redis
      - postgres
```

### 2. Deployment Steps

1. Deploy database migrations
2. Deploy new services
3. Run data synchronization
4. Switch traffic to new system
5. Monitor for issues

## Phase 5: Monitoring

### 1. Metrics Setup

```typescript
// src/monitoring/metrics.ts
export class MetricsCollector {
  private prometheus: PrometheusClient;

  constructor() {
    this.prometheus = new PrometheusClient();
  }

  recordFixMetrics(metrics: FixMetrics): void {
    this.prometheus.gauge("fix_session_status", metrics.status);
    this.prometheus.counter("fix_messages_total", metrics.messageCount);
  }
}
```

### 2. Alerting Setup

```typescript
// src/monitoring/alerts.ts
export class AlertManager {
  private alertRules: AlertRule[];

  constructor() {
    this.alertRules = this.loadAlertRules();
  }

  checkAlerts(metrics: Metrics): void {
    this.alertRules.forEach((rule) => {
      if (rule.evaluate(metrics)) {
        this.sendAlert(rule);
      }
    });
  }
}
```

## Rollback Plan

### 1. Immediate Rollback

```bash
# Revert to previous version
git checkout v1.0.0
docker-compose down
docker-compose up -d
```

### 2. Data Recovery

```sql
-- Restore from backup
RESTORE DATABASE trading_app FROM '/backup/trading_app.bak';
```

## Post-Migration Tasks

1. **Performance Optimization**

   - Monitor system performance
   - Optimize database queries
   - Fine-tune caching

2. **Documentation Updates**

   - Update API documentation
   - Update system architecture docs
   - Update deployment guides

3. **Training**
   - Train support team
   - Update troubleshooting guides
   - Document common issues

## Success Criteria

1. **Functionality**

   - All orders execute correctly
   - Market data is accurate
   - Technical indicators are calculated correctly

2. **Performance**

   - Order execution < 100ms
   - Market data latency < 1s
   - System uptime > 99.9%

3. **Reliability**
   - No data loss
   - No order duplication
   - Proper error handling
