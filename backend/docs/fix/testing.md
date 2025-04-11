# FIX Protocol Testing Guide

## Overview

This document outlines the testing strategy and implementation for the FIX protocol integration.

## Testing Environment Setup

### 1. Test Configuration

```typescript
// config/test.config.ts
export const testConfig = {
  fix: {
    senderCompId: "TEST_SENDER",
    targetCompId: "TEST_TARGET",
    socketHost: "localhost",
    socketPort: 5001,
    heartbeatInterval: 30,
    reconnectInterval: 60,
  },
  marketData: {
    symbols: ["BTCUSDT", "ETHUSDT"],
    updateInterval: 1000,
  },
  orders: {
    maxOrdersPerSymbol: 10,
    orderTimeout: 5000,
  },
};
```

### 2. Mock FIX Server

```typescript
// test/mocks/fixServer.ts
class MockFixServer {
  private server: net.Server;
  private connections: net.Socket[] = [];

  async start(): Promise<void> {
    this.server = net.createServer((socket) => {
      this.connections.push(socket);
      this.handleConnection(socket);
    });

    await new Promise((resolve) => {
      this.server.listen(5001, () => resolve());
    });
  }

  private handleConnection(socket: net.Socket): void {
    socket.on("data", (data) => {
      // Parse FIX message
      // Send appropriate response
    });
  }

  async stop(): Promise<void> {
    for (const conn of this.connections) {
      conn.destroy();
    }
    await new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
```

## Unit Testing

### 1. Message Validation Tests

```typescript
// test/unit/messageValidation.test.ts
describe("Message Validation", () => {
  test("Market Data Request Validation", () => {
    const validRequest = {
      MDReqID: "TEST123",
      SubscriptionRequestType: "0",
      MarketDepth: 0,
      MDUpdateType: "0",
      NoMDEntryTypes: 1,
      NoRelatedSym: 1,
      EntryType: "0",
      Symbol: "BTCUSDT",
      SecurityType: "CURRENCY",
      SecurityExchange: "BINANCE",
    };

    expect(validateMarketDataRequest(validRequest)).toBe(true);
  });

  test("New Order Single Validation", () => {
    const validOrder = {
      ClOrdID: "TEST123",
      Side: "1",
      TransactTime: new Date().toISOString(),
      OrdType: "2",
      Price: 50000,
      OrderQty: 0.1,
      TimeInForce: "1",
      Symbol: "BTCUSDT",
      SecurityType: "CURRENCY",
      SecurityExchange: "BINANCE",
    };

    expect(validateNewOrder(validOrder)).toBe(true);
  });
});
```

### 2. Service Tests

```typescript
// test/unit/services.test.ts
describe("FIX Services", () => {
  let fixService: FixService;
  let marketDataService: MarketDataService;
  let orderService: OrderService;

  beforeEach(() => {
    fixService = new FixService(testConfig.fix);
    marketDataService = new MarketDataService(fixService);
    orderService = new OrderService(fixService);
  });

  test("Market Data Service", async () => {
    const data = await marketDataService.getSnapshot("BTCUSDT");
    expect(data).toBeDefined();
    expect(data.symbol).toBe("BTCUSDT");
  });

  test("Order Service", async () => {
    const order = await orderService.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 0.1,
    });

    expect(order.status).toBe("NEW");
    expect(order.symbol).toBe("BTCUSDT");
  });
});
```

## Integration Testing

### 1. Market Data Flow Tests

```typescript
// test/integration/marketData.test.ts
describe("Market Data Flow", () => {
  let mockServer: MockFixServer;
  let fixService: FixService;

  beforeAll(async () => {
    mockServer = new MockFixServer();
    await mockServer.start();
    fixService = new FixService(testConfig.fix);
  });

  afterAll(async () => {
    await mockServer.stop();
    await fixService.disconnect();
  });

  test("Market Data Subscription", async () => {
    const subscription = await fixService.subscribeMarketData("BTCUSDT");
    expect(subscription.status).toBe("ACTIVE");
  });

  test("Market Data Updates", async () => {
    const updates = await new Promise((resolve) => {
      const updates: any[] = [];
      fixService.on("marketData", (data) => {
        updates.push(data);
        if (updates.length >= 3) resolve(updates);
      });
    });

    expect(updates.length).toBeGreaterThanOrEqual(3);
    expect(updates[0].symbol).toBe("BTCUSDT");
  });
});
```

### 2. Order Flow Tests

```typescript
// test/integration/orderFlow.test.ts
describe("Order Flow", () => {
  let mockServer: MockFixServer;
  let orderService: OrderService;

  beforeAll(async () => {
    mockServer = new MockFixServer();
    await mockServer.start();
    orderService = new OrderService(new FixService(testConfig.fix));
  });

  afterAll(async () => {
    await mockServer.stop();
    await orderService.disconnect();
  });

  test("Order Creation and Execution", async () => {
    const order = await orderService.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 0.1,
    });

    expect(order.status).toBe("NEW");

    const execution = await new Promise((resolve) => {
      orderService.on("execution", (data) => {
        if (data.orderId === order.id) resolve(data);
      });
    });

    expect(execution.status).toBe("FILLED");
    expect(execution.quantity).toBe(0.1);
  });

  test("Order Cancellation", async () => {
    const order = await orderService.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 0.1,
    });

    await orderService.cancelOrder(order.id);

    const cancelReport = await new Promise((resolve) => {
      orderService.on("execution", (data) => {
        if (data.orderId === order.id && data.status === "CANCELED") {
          resolve(data);
        }
      });
    });

    expect(cancelReport.status).toBe("CANCELED");
  });
});
```

## Performance Testing

### 1. Load Testing

```typescript
// test/performance/load.test.ts
describe("Load Testing", () => {
  let mockServer: MockFixServer;
  let fixService: FixService;

  beforeAll(async () => {
    mockServer = new MockFixServer();
    await mockServer.start();
    fixService = new FixService(testConfig.fix);
  });

  afterAll(async () => {
    await mockServer.stop();
    await fixService.disconnect();
  });

  test("High Volume Market Data", async () => {
    const startTime = Date.now();
    const messageCount = 1000;
    let receivedCount = 0;

    await fixService.subscribeMarketData("BTCUSDT");

    await new Promise((resolve) => {
      fixService.on("marketData", () => {
        receivedCount++;
        if (receivedCount >= messageCount) resolve(null);
      });
    });

    const duration = Date.now() - startTime;
    const messagesPerSecond = messageCount / (duration / 1000);

    expect(messagesPerSecond).toBeGreaterThan(100);
  });

  test("Order Processing", async () => {
    const startTime = Date.now();
    const orderCount = 100;
    const orders = [];

    for (let i = 0; i < orderCount; i++) {
      orders.push(
        fixService.createOrder({
          symbol: "BTCUSDT",
          side: "BUY",
          type: "LIMIT",
          price: 50000 + i,
          quantity: 0.1,
        })
      );
    }

    await Promise.all(orders);
    const duration = Date.now() - startTime;
    const ordersPerSecond = orderCount / (duration / 1000);

    expect(ordersPerSecond).toBeGreaterThan(10);
  });
});
```

### 2. Stress Testing

```typescript
// test/performance/stress.test.ts
describe("Stress Testing", () => {
  let mockServer: MockFixServer;
  let fixService: FixService;

  beforeAll(async () => {
    mockServer = new MockFixServer();
    await mockServer.start();
    fixService = new FixService(testConfig.fix);
  });

  afterAll(async () => {
    await mockServer.stop();
    await fixService.disconnect();
  });

  test("Connection Recovery", async () => {
    // Simulate network disconnection
    await mockServer.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await mockServer.start();

    // Verify reconnection
    const isConnected = await fixService.isConnected();
    expect(isConnected).toBe(true);
  });

  test("Message Processing Under Load", async () => {
    const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT"];
    const subscriptions = symbols.map((symbol) =>
      fixService.subscribeMarketData(symbol)
    );

    await Promise.all(subscriptions);

    // Monitor message processing
    const metrics = await fixService.getMetrics();
    expect(metrics.messageProcessingTime).toBeLessThan(100); // ms
    expect(metrics.messageQueueSize).toBeLessThan(1000);
  });
});
```

## End-to-End Testing

### 1. Trading Flow Tests

```typescript
// test/e2e/trading.test.ts
describe("Trading Flow", () => {
  let tradingSystem: TradingSystem;

  beforeAll(async () => {
    tradingSystem = new TradingSystem(testConfig);
    await tradingSystem.initialize();
  });

  afterAll(async () => {
    await tradingSystem.shutdown();
  });

  test("Complete Trading Cycle", async () => {
    // Subscribe to market data
    await tradingSystem.subscribeMarketData("BTCUSDT");

    // Create and execute order
    const order = await tradingSystem.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 0.1,
    });

    // Verify order execution
    const execution = await tradingSystem.waitForExecution(order.id);
    expect(execution.status).toBe("FILLED");

    // Verify position update
    const position = await tradingSystem.getPosition("BTCUSDT");
    expect(position.quantity).toBe(0.1);

    // Verify analytics update
    const analytics = await tradingSystem.getAnalytics();
    expect(analytics.totalTrades).toBe(1);
    expect(analytics.totalVolume).toBe(0.1);
  });
});
```

### 2. System Integration Tests

```typescript
// test/e2e/system.test.ts
describe("System Integration", () => {
  let system: TradingSystem;

  beforeAll(async () => {
    system = new TradingSystem(testConfig);
    await system.initialize();
  });

  afterAll(async () => {
    await system.shutdown();
  });

  test("System Components Integration", async () => {
    // Test market data flow
    const marketData = await system.getMarketData("BTCUSDT");
    expect(marketData).toBeDefined();

    // Test order management
    const order = await system.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 0.1,
    });
    expect(order.status).toBe("NEW");

    // Test position management
    const position = await system.getPosition("BTCUSDT");
    expect(position).toBeDefined();

    // Test risk management
    const riskMetrics = await system.getRiskMetrics();
    expect(riskMetrics).toBeDefined();

    // Test analytics
    const analytics = await system.getAnalytics();
    expect(analytics).toBeDefined();
  });
});
```

## Test Coverage

### 1. Coverage Configuration

```json
{
  "coverage": {
    "statements": 80,
    "branches": 80,
    "functions": 80,
    "lines": 80
  }
}
```

### 2. Coverage Report

```typescript
// scripts/coverage.ts
import { runTests } from "@jest/coverage";

async function generateCoverageReport() {
  const results = await runTests({
    collectCoverage: true,
    coverageReporters: ["text", "lcov", "html"],
  });

  console.log("Coverage Report:");
  console.log(`Statements: ${results.coverage.statements}%`);
  console.log(`Branches: ${results.coverage.branches}%`);
  console.log(`Functions: ${results.coverage.functions}%`);
  console.log(`Lines: ${results.coverage.lines}%`);
}
```

## Continuous Integration

### 1. GitHub Actions Workflow

```yaml
name: FIX Protocol Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run performance tests
        run: npm run test:performance

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Generate coverage report
        run: npm run coverage

      - name: Upload coverage report
        uses: actions/upload-artifact@v2
        with:
          name: coverage-report
          path: coverage/
```

## Test Data Management

### 1. Test Data Generation

```typescript
// test/utils/dataGenerator.ts
class TestDataGenerator {
  static generateMarketData(symbol: string): MarketDataSnapshot {
    return {
      MDReqID: `TEST_${Date.now()}`,
      Symbol: symbol,
      SecurityType: "CURRENCY",
      SecurityExchange: "BINANCE",
      NoMDEntries: 1,
      MDEntryType: "0",
      MDEntryPx: 50000 + Math.random() * 1000,
      MDEntrySize: 0.1 + Math.random() * 1,
      MDEntryTime: new Date().toISOString(),
      MDEntryID: `ENTRY_${Date.now()}`,
      MDUpdateAction: "0",
    };
  }

  static generateOrder(symbol: string): NewOrderSingle {
    return {
      ClOrdID: `ORDER_${Date.now()}`,
      Side: "1",
      TransactTime: new Date().toISOString(),
      OrdType: "2",
      Price: 50000 + Math.random() * 1000,
      OrderQty: 0.1 + Math.random() * 1,
      TimeInForce: "1",
      Symbol: symbol,
      SecurityType: "CURRENCY",
      SecurityExchange: "BINANCE",
    };
  }
}
```

### 2. Test Data Cleanup

```typescript
// test/utils/cleanup.ts
async function cleanupTestData() {
  // Clean up test orders
  await db.query("DELETE FROM orders WHERE cl_ord_id LIKE $1", ["TEST_%"]);

  // Clean up test market data
  await db.query("DELETE FROM market_data WHERE md_req_id LIKE $1", ["TEST_%"]);

  // Clean up test positions
  await db.query("DELETE FROM positions WHERE symbol IN ($1)", [
    ["BTCUSDT", "ETHUSDT"],
  ]);
}
```
