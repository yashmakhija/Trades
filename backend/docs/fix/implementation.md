# FIX Protocol Implementation Details

## Implementation Steps

### 1. Dependencies Setup

```json
{
  "dependencies": {
    "quickfix": "^1.0.0",
    "quickfix-javascript": "^1.0.0",
    "typescript": "^5.0.0",
    "@types/quickfix": "^1.0.0"
  }
}
```

### 2. FIX Message Types

#### Market Data Messages

```typescript
// Market Data Request
interface MarketDataRequest {
  MDReqID: string;
  SubscriptionRequestType: "0" | "1" | "2"; // 0=Snapshot, 1=Snapshot+Updates, 2=Disable
  MarketDepth: number;
  MDUpdateType: "0" | "1"; // 0=Full, 1=Incremental
  NoMDEntryTypes: Array<{
    MDEntryType: "0" | "1" | "2" | "3" | "4"; // Bid, Offer, Trade, Index, Open
  }>;
  NoRelatedSym: Array<{
    Symbol: string;
    SecurityType: string;
    SecurityExchange: string;
  }>;
}

// Market Data Response
interface MarketDataResponse {
  MDReqID: string;
  NoMDEntries: Array<{
    MDEntryType: string;
    MDEntryPx: number;
    MDEntrySize: number;
    MDEntryTime: string;
  }>;
}
```

#### Order Messages

```typescript
// New Order Single
interface NewOrderSingle {
  ClOrdID: string;
  Symbol: string;
  Side: "1" | "2"; // 1=Buy, 2=Sell
  TransactTime: string;
  OrdType: "1" | "2" | "3" | "4"; // Market, Limit, Stop, Stop Limit
  OrderQty: number;
  Price?: number;
  StopPx?: number;
  TimeInForce: "1" | "3" | "4" | "5" | "6"; // GTC, IOC, FOK, etc.
}

// Execution Report
interface ExecutionReport {
  OrderID: string;
  ClOrdID: string;
  ExecID: string;
  ExecType: string;
  OrdStatus: string;
  Symbol: string;
  Side: string;
  LeavesQty: number;
  CumQty: number;
  AvgPx: number;
  LastPx: number;
  LastQty: number;
  TransactTime: string;
}
```

### 3. FIX Service Implementation

```typescript
// src/services/fix/FixService.ts
import { QuickFix } from "quickfix";
import { EventEmitter } from "events";

export class FixService extends EventEmitter {
  private fix: QuickFix;
  private session: any;
  private config: FixConfig;

  constructor(config: FixConfig) {
    super();
    this.config = config;
    this.fix = new QuickFix(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.fix.on("logon", this.handleLogon.bind(this));
    this.fix.on("logout", this.handleLogout.bind(this));
    this.fix.on("error", this.handleError.bind(this));
    this.fix.on("message", this.handleMessage.bind(this));
  }

  private handleLogon(session: any): void {
    this.session = session;
    this.emit("connected");
    this.subscribeToMarketData();
  }

  private handleLogout(): void {
    this.session = null;
    this.emit("disconnected");
  }

  private handleError(error: Error): void {
    this.emit("error", error);
  }

  private handleMessage(message: any): void {
    switch (message.msgType) {
      case "W": // Market Data Snapshot
        this.handleMarketDataSnapshot(message);
        break;
      case "8": // Execution Report
        this.handleExecutionReport(message);
        break;
      // Add more message type handlers
    }
  }

  private async subscribeToMarketData(): Promise<void> {
    const request: MarketDataRequest = {
      MDReqID: `MD_${Date.now()}`,
      SubscriptionRequestType: "1",
      MarketDepth: 0,
      MDUpdateType: "0",
      NoMDEntryTypes: [
        { MDEntryType: "0" }, // Bid
        { MDEntryType: "1" }, // Offer
        { MDEntryType: "2" }, // Trade
      ],
      NoRelatedSym: this.config.symbols.map((symbol) => ({
        Symbol: symbol,
        SecurityType: "CURRENCY",
        SecurityExchange: "BINANCE",
      })),
    };

    await this.sendMessage(request);
  }

  public async sendOrder(order: NewOrderSingle): Promise<string> {
    return await this.sendMessage(order);
  }

  private async sendMessage(message: any): Promise<string> {
    if (!this.session) {
      throw new Error("No active FIX session");
    }
    return await this.session.send(message);
  }
}
```

### 4. Market Data Handler

```typescript
// src/services/fix/MarketDataHandler.ts
import { RedisService } from "../redisService";
import { TimescaleDBService } from "../timescaleDBService";

export class MarketDataHandler {
  constructor(
    private redis: RedisService,
    private timescaleDB: TimescaleDBService
  ) {}

  async handleMarketDataSnapshot(message: any): Promise<void> {
    const { NoMDEntries, Symbol } = message;

    // Update Redis cache
    await this.redis.updateMarketData(Symbol, NoMDEntries);

    // Store in TimescaleDB
    await this.timescaleDB.storeMarketData(Symbol, NoMDEntries);

    // Emit event for real-time updates
    this.emit("marketDataUpdate", {
      symbol: Symbol,
      data: NoMDEntries,
    });
  }
}
```

### 5. Order Handler

```typescript
// src/services/fix/OrderHandler.ts
import { OrderManager } from "../orderManager";
import { PositionManager } from "../positionManager";

export class OrderHandler {
  constructor(
    private orderManager: OrderManager,
    private positionManager: PositionManager
  ) {}

  async handleExecutionReport(message: any): Promise<void> {
    const { OrderID, ExecType, OrdStatus, Symbol, Side, LastQty, LastPx } =
      message;

    switch (ExecType) {
      case "0": // New
        await this.handleNewOrder(message);
        break;
      case "1": // Trade
        await this.handleTrade(message);
        break;
      case "4": // Rejected
        await this.handleRejectedOrder(message);
        break;
      case "5": // Canceled
        await this.handleCanceledOrder(message);
        break;
    }
  }

  private async handleTrade(message: any): Promise<void> {
    // Update order status
    await this.orderManager.updateOrderStatus(message);

    // Update position
    await this.positionManager.updatePosition(message);

    // Emit trade event
    this.emit("trade", message);
  }
}
```

### 6. Configuration

```typescript
// src/config/fix.ts
export interface FixConfig {
  // Connection settings
  host: string;
  port: number;
  senderCompID: string;
  targetCompID: string;

  // Session settings
  heartbeatInterval: number;
  resetOnLogon: boolean;

  // Trading settings
  symbols: string[];
  supportedOrderTypes: string[];

  // Security settings
  useSSL: boolean;
  sslCert?: string;
  sslKey?: string;

  // Logging settings
  logLevel: "debug" | "info" | "warn" | "error";
  logFile: string;
}
```

### 7. Integration with Existing Services

```typescript
// src/services/orderManager.ts
export class OrderManager {
  constructor(private fixService: FixService) {}

  async createOrder(order: Order): Promise<string> {
    const fixOrder = this.convertToFixOrder(order);
    return await this.fixService.sendOrder(fixOrder);
  }

  private convertToFixOrder(order: Order): NewOrderSingle {
    return {
      ClOrdID: order.id,
      Symbol: order.symbol,
      Side: order.side === "BUY" ? "1" : "2",
      TransactTime: new Date().toISOString(),
      OrdType: this.mapOrderType(order.type),
      OrderQty: order.quantity,
      Price: order.price,
      StopPx: order.stopPrice,
      TimeInForce: "1", // GTC
    };
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
// src/tests/fix/FixService.test.ts
describe("FixService", () => {
  let fixService: FixService;
  let mockConfig: FixConfig;

  beforeEach(() => {
    mockConfig = {
      host: "test.binance.com",
      port: 443,
      senderCompID: "TEST",
      targetCompID: "BINANCE",
      heartbeatInterval: 30,
      resetOnLogon: true,
      symbols: ["BTCUSDT"],
      supportedOrderTypes: ["1", "2"],
      useSSL: true,
      logLevel: "debug",
      logFile: "fix.log",
    };
    fixService = new FixService(mockConfig);
  });

  test("should connect successfully", async () => {
    await expect(fixService.connect()).resolves.not.toThrow();
  });

  test("should handle market data messages", async () => {
    const message = {
      msgType: "W",
      Symbol: "BTCUSDT",
      NoMDEntries: [{ MDEntryType: "0", MDEntryPx: 50000, MDEntrySize: 1 }],
    };

    await fixService.handleMessage(message);
    // Add assertions
  });
});
```

### 2. Integration Tests

```typescript
// src/tests/integration/fix-integration.test.ts
describe("FIX Integration", () => {
  let fixService: FixService;
  let orderManager: OrderManager;
  let marketDataHandler: MarketDataHandler;

  beforeAll(async () => {
    // Setup test environment
    fixService = new FixService(testConfig);
    orderManager = new OrderManager(fixService);
    marketDataHandler = new MarketDataHandler(redis, timescaleDB);
  });

  test("should process complete order flow", async () => {
    // Create order
    const order = await orderManager.createOrder({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: 0.1,
      price: 50000,
    });

    // Verify order status
    const status = await orderManager.getOrderStatus(order);
    expect(status).toBe("NEW");

    // Simulate execution
    await fixService.simulateExecution(order);

    // Verify final status
    const finalStatus = await orderManager.getOrderStatus(order);
    expect(finalStatus).toBe("FILLED");
  });
});
```

## Deployment Considerations

### 1. Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### 2. Environment Variables

```env
FIX_HOST=fix.binance.com
FIX_PORT=443
FIX_SENDER_COMP_ID=YOUR_SENDER_ID
FIX_TARGET_COMP_ID=BINANCE
FIX_HEARTBEAT_INTERVAL=30
FIX_RESET_ON_LOGON=true
FIX_SYMBOLS=BTCUSDT,ETHUSDT
FIX_USE_SSL=true
FIX_LOG_LEVEL=info
```

### 3. Health Checks

```typescript
// src/health/fixHealth.ts
export class FixHealthCheck {
  constructor(private fixService: FixService) {}

  async check(): Promise<HealthStatus> {
    const isConnected = this.fixService.isConnected();
    const lastHeartbeat = this.fixService.getLastHeartbeat();

    return {
      status: isConnected ? "healthy" : "unhealthy",
      details: {
        connected: isConnected,
        lastHeartbeat,
        messageCount: this.fixService.getMessageCount(),
      },
    };
  }
}
```

## Monitoring and Logging

### 1. Metrics Collection

```typescript
// src/monitoring/fixMetrics.ts
export class FixMetrics {
  private messageCounter: Counter;
  private latencyHistogram: Histogram;
  private errorCounter: Counter;

  constructor() {
    this.messageCounter = new Counter({
      name: "fix_messages_total",
      help: "Total number of FIX messages processed",
    });

    this.latencyHistogram = new Histogram({
      name: "fix_message_latency_seconds",
      help: "FIX message processing latency",
    });

    this.errorCounter = new Counter({
      name: "fix_errors_total",
      help: "Total number of FIX errors",
    });
  }

  recordMessage(msgType: string): void {
    this.messageCounter.inc({ msgType });
  }

  recordLatency(seconds: number): void {
    this.latencyHistogram.observe(seconds);
  }

  recordError(): void {
    this.errorCounter.inc();
  }
}
```

### 2. Logging Configuration

```typescript
// src/config/logger.ts
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: config.logFile,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.Console(),
  ],
});
```
