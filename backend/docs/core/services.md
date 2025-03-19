# Core Services

The backend relies on several key services that handle the business logic of the trading application. These services work together to provide real-time trading functionality.

## Order Manager Service

The Order Manager is the heart of the trading system, responsible for:

- **In-memory order tracking**: Maintains collections of all open orders for quick access
- **Order execution**: Monitors price changes to trigger stop-loss and take-profit orders
- **Order lifecycle management**: Handles the flow of orders from creation to execution to closing
- **PnL calculation**: Computes profit and loss when orders are closed

Key components:

```typescript
class OrderManager extends EventEmitter {
  private openOrders: Map<string, Order> = new Map();
  private userOrders: Map<string, Set<string>> = new Map();
  private stopLossOrders: Map<string, Map<string, Order>> = new Map();
  private takeProfitOrders: Map<string, Map<string, Order>> = new Map();

  // Core methods
  async addOrder(orderData): Promise<Order> { ... }
  async cancelOrder(orderId, userId): Promise<boolean> { ... }
  async checkPriceTriggers(symbol, price): Promise<void> { ... }
  private async executeOrder(orderId, price, triggerType): Promise<void> { ... }
}
```

The Order Manager optimizes for performance by using in-memory data structures while still persisting changes to the database.

## Balance Manager Service

The Balance Manager handles all user balance operations:

- **Balance checking**: Validates if users have sufficient funds for operations
- **Balance reservation**: Reserves funds when orders are placed
- **PnL accounting**: Updates balances when trades are closed
- **Balance history**: Tracks all balance changes for auditing

Key components:

```typescript
class BalanceManager extends EventEmitter {
  private userBalances: Map<string, UserBalance> = new Map();
  private reservedBalances: Map<string, Map<string, number>> = new Map();

  // Core methods
  async canPlaceOrder(userId, orderCost): Promise<boolean> { ... }
  async reserveBalance(userId, orderId, amount): Promise<void> { ... }
  async releaseReservedBalance(userId, orderId): Promise<void> { ... }
  async updateBalanceAfterExecution(userId, orderId, symbol, quantity, price, type): Promise<void> { ... }
}
```

The Balance Manager maintains an in-memory cache of user balances for quick access while ensuring data is persisted to the database.

## Binance Service

The Binance Service is responsible for connecting to external market data:

- **WebSocket connection**: Maintains connection to Binance WebSocket API
- **Market data processing**: Processes ticker and candlestick data
- **Symbol tracking**: Manages which symbols to track based on user activity
- **Price updates**: Triggers order execution when prices hit targets

Key components:

```typescript
// Functions
async function initializeSymbols(): Promise<void> { ... }
function processTickerData(data: BinanceTickerMessage): ProcessedTickerData { ... }
async function updateSymbolPrice(data: ProcessedTickerData): Promise<void> { ... }
async function processKlineData(data: BinanceKlineMessage): Promise<void> { ... }
export async function startBinanceWebSocket(): Promise<void> { ... }
```

The Binance Service connects to Binance's public WebSocket API to get real-time price data, which is crucial for the trading system.

## WebSocket Service

The WebSocket Service manages real-time communication with clients:

- **Client connection management**: Handles client connections and authentication
- **Subscription system**: Allows clients to subscribe to specific symbols or data
- **Data broadcasting**: Sends real-time updates to connected clients
- **Channel management**: Separates public and private data channels

Key components:

```typescript
class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, WSClient>();

  // Core methods
  public initWebSocketServer(server: Server): void { ... }
  public broadcastToUser(userId, type, data): void { ... }
  public broadcastTickerUpdate(symbol, data): void { ... }
  public broadcastOrderUpdate(userId, orderData): void { ... }
  public broadcastBalanceUpdate(userId, balanceData): void { ... }
}
```

The WebSocket Service enables real-time interaction with the frontend, providing immediate feedback on orders, trades, and market movements.

## Candle Service

The Candle Service manages candlestick (OHLCV) data:

- **Candle generation**: Creates OHLCV data from ticker updates
- **Timeframe management**: Supports multiple timeframes (1m, 5m, 15m, etc.)
- **Historical data**: Provides access to historical candle data
- **Optimized storage**: Uses TimescaleDB for efficient time-series storage

Key components:

```typescript
class CandleService {
  // Core methods
  async processTickerUpdate(symbol, price, timestamp): Promise<void> { ... }
  async getCandles(symbol, timeframe, limit, startTime, endTime): Promise<Candle[]> { ... }
  async getCandlesForTimeframe(symbol, timeframe, limit): Promise<Candle[]> { ... }
}
```

The Candle Service is essential for providing chart data to the frontend and for technical analysis.

## Trade Analytics Service

The Trade Analytics Service processes trade data to provide insights:

- **Performance metrics**: Calculates win rates, average profit/loss, etc.
- **Historical analysis**: Tracks performance over time
- **Trade statistics**: Provides statistics on trading patterns
- **Risk metrics**: Calculates exposure, drawdowns, etc.

Key components:

```typescript
class TradeAnalyticsService {
  // Core methods
  async getUserTradeStats(userId): Promise<TradeStats> { ... }
  async getTradeHistory(userId, limit, offset): Promise<Trade[]> { ... }
  async calculateProfitByTimeframe(userId, timeframe): Promise<ProfitByTime[]> { ... }
}
```

The Trade Analytics Service helps users understand their trading performance and make better decisions.

## Service Interactions

These services do not operate in isolation but form a cohesive system:

1. **Binance Service** receives market data and updates prices
2. **Order Manager** checks if any orders should be triggered by new prices
3. **Balance Manager** updates user balances when orders are executed
4. **WebSocket Service** notifies clients of price changes and order executions
5. **Candle Service** updates candle data based on new prices
6. **Trade Analytics Service** updates statistics when trades are completed

This event-driven architecture allows for real-time processing of market data and orders.
