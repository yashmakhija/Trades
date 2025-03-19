# Real-time Processing

The Trading App backend implements a sophisticated real-time processing system that handles market data, order execution, and client notifications. This document explains the key components and processes involved.

## Event-Driven Architecture

The system follows an event-driven architecture where:

1. External events (price changes) trigger internal events
2. Internal events (order execution) trigger notifications
3. Notifications are broadcast to relevant clients

This chain of events happens in near real-time, providing a responsive trading experience.

## Market Data Processing

### Binance WebSocket Integration

The system connects to Binance's WebSocket API to receive real-time market data:

```typescript
export async function startBinanceWebSocket(): Promise<void> {
  try {
    // Initialize symbols before connecting
    await initializeSymbols();

    // Create WebSocket connection
    ws = new WebSocket("wss://stream.binance.com:9443/ws");

    // Set up event handlers
    ws.on("open", () => {
      console.log("Connected to Binance WebSocket");
      subscribeToStreams(ws);
      setupHeartbeat();
    });

    ws.on("message", handleWebSocketMessage);

    // Error and close handlers
    // ...
  } catch (error) {
    console.error("Error starting Binance WebSocket:", error);
    reconnectWebSocket();
  }
}
```

The WebSocket connection:

- Receives ticker updates for all tracked symbols
- Processes these updates into a standardized format
- Updates the latest prices in the system
- Triggers order execution checks

### Market Data Transformation

Raw market data is processed into a standardized format:

```typescript
function processTickerData(data: BinanceTickerMessage): ProcessedTickerData {
  const price = Math.round(parseFloat(data.c) * 100);

  return {
    symbol: data.s.toLowerCase(),
    price,
    priceUsd: price / 100,
    timestamp: Date.now(),
  };
}
```

All price data is converted to integers to avoid floating-point precision issues.

## Real-time Order Processing

### Price-Triggered Order Execution

When a new price update is received, the system checks if any orders should be executed:

```typescript
async checkPriceTriggers(symbol: string, price: number): Promise<void> {
  // Check stop-loss orders
  const stopLossOrders = this.stopLossOrders.get(symbol);
  if (stopLossOrders) {
    for (const [orderId, order] of stopLossOrders.entries()) {
      if (this.shouldTriggerStopLoss(order, price)) {
        await this.executeOrder(orderId, price, "STOP_LOSS");
      }
    }
  }

  // Check take-profit orders
  const takeProfitOrders = this.takeProfitOrders.get(symbol);
  if (takeProfitOrders) {
    for (const [orderId, order] of takeProfitOrders.entries()) {
      if (this.shouldTriggerTakeProfit(order, price)) {
        await this.executeOrder(orderId, price, "TAKE_PROFIT");
      }
    }
  }
}
```

This in-memory processing allows for near-instant execution when price conditions are met.

### Order Execution Flow

When an order is triggered:

1. The order status is updated to CLOSED
2. Exit price and PnL are calculated
3. User balance is updated
4. Balance history is recorded
5. Order is removed from in-memory tracking
6. Client is notified of order execution

## Real-time Client Communication

### WebSocket Server

The system uses a WebSocket server to communicate with clients:

```typescript
public initWebSocketServer(server: Server): void {
  this.wss = new WebSocketServer({
    server,
    path: "/ws",
    clientTracking: true,
    perMessageDeflate: false,
  });

  this.wss.on("connection", this.handleConnection.bind(this));

  // Set up ping/pong for connection maintenance
  // ...
}
```

### Client Authentication

Clients authenticate via JWT tokens:

```typescript
private async handleConnection(ws: WebSocket, request: any): Promise<void> {
  const client: WSClient = {
    ws,
    isAlive: true,
    subscribedSymbols: new Set(),
    isAuthenticated: false,
  };

  this.clients.set(ws, client);

  // Handle messages from client
  ws.on("message", async (message) => {
    await this.handleClientMessage(ws, message);
  });

  // Handle connection close and pong
  // ...
}
```

### Subscription System

Clients can subscribe to specific data channels:

```typescript
private async handleClientMessage(ws: WebSocket, message: WebSocket.Data): Promise<void> {
  try {
    const client = this.clients.get(ws);
    if (!client) return;

    const parsedMessage = JSON.parse(message.toString());

    // Handle different message types
    switch (parsedMessage.type) {
      case "authenticate":
        // Handle authentication
        // ...
        break;

      case "subscribe":
        // Handle subscription
        // ...
        break;

      case "unsubscribe":
        // Handle unsubscription
        // ...
        break;
    }
  } catch (error) {
    console.error("Error handling WebSocket message:", error);
  }
}
```

### Broadcasting Updates

The system broadcasts different types of updates to clients:

```typescript
// Broadcast to all clients subscribed to a symbol
public broadcastTickerUpdate(symbol: string, data: any): void {
  if (!this.wss) return;

  this.clients.forEach((client) => {
    if (client.subscribedSymbols.has(symbol) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: "ticker",
        symbol,
        data
      }));
    }
  });
}

// Broadcast to a specific user
public broadcastOrderUpdate(userId: string, orderData: any): void {
  this.broadcastToUser(userId, "order", orderData);
}
```

## Performance Optimization

### In-memory Data Structures

The system uses in-memory data structures for performance:

- Maps for open orders, user orders, stop-loss orders, and take-profit orders
- Sets for tracking subscribed symbols
- Caches for user balances and symbol information

### Efficient Data Broadcasting

The WebSocket service efficiently broadcasts updates:

- Only sending updates to clients who have subscribed to that data
- Using binary WebSocket data when possible
- Minimizing the payload size by sending only essential data

### Connection Management

The WebSocket service implements ping/pong to maintain healthy connections:

```typescript
// Health check interval
this.pingInterval = setInterval(() => {
  this.clients.forEach((client, ws) => {
    if (!client.isAlive) {
      this.clients.delete(ws);
      return ws.terminate();
    }
    client.isAlive = false;
    ws.ping();
  });
}, 30000);
```

## Diagram: Real-time Processing Flow

```
┌─────────────────┐     ┌───────────────┐     ┌─────────────────┐
│                 │     │               │     │                 │
│  Binance API    │────▶│  BinanceService │────▶│  OrderManager   │
│                 │     │               │     │                 │
└─────────────────┘     └───────────────┘     └────────┬────────┘
                                                      │
                                                      │
                                                      ▼
┌─────────────────┐     ┌───────────────┐     ┌─────────────────┐
│                 │     │               │     │                 │
│  Clients        │◀────│  WebSocketService │◀────│  BalanceManager │
│                 │     │               │     │                 │
└─────────────────┘     └───────────────┘     └─────────────────┘
```

This real-time processing architecture ensures that the trading system is responsive and efficient, providing a seamless experience for users.
