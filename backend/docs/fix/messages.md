# FIX Protocol Messages Guide

## Overview

This document details the FIX protocol messages used in our implementation for market data and order management.

## Market Data Messages

### 1. Market Data Request (V)

```typescript
interface MarketDataRequest {
  MDReqID: string; // Unique request ID
  SubscriptionRequestType: "0" | "1" | "2"; // 0=Snapshot, 1=Snapshot+Updates, 2=Disable
  MarketDepth: number; // 0=Full Book, 1=Top of Book
  MDUpdateType: "0" | "1"; // 0=Full Refresh, 1=Incremental Refresh
  NoMDEntryTypes: number; // Number of entry types
  NoRelatedSym: number; // Number of symbols
  EntryType: string; // Bid, Offer, Trade, etc.
  Symbol: string; // Trading pair
  SecurityType: string; // Type of security
  SecurityExchange: string; // Exchange identifier
}
```

### 2. Market Data Snapshot Full Refresh (W)

```typescript
interface MarketDataSnapshot {
  MDReqID: string;
  Symbol: string;
  SecurityType: string;
  SecurityExchange: string;
  NoMDEntries: number;
  MDEntryType: string;
  MDEntryPx: number;
  MDEntrySize: number;
  MDEntryTime: string;
  MDEntryID: string;
  MDUpdateAction: "0" | "1" | "2"; // New, Change, Delete
}
```

### 3. Market Data Incremental Refresh (X)

```typescript
interface MarketDataIncremental {
  MDReqID: string;
  NoMDEntries: number;
  MDEntryType: string;
  MDEntryPx: number;
  MDEntrySize: number;
  MDEntryTime: string;
  MDEntryID: string;
  MDUpdateAction: "0" | "1" | "2";
}
```

## Order Management Messages

### 1. New Order Single (D)

```typescript
interface NewOrderSingle {
  ClOrdID: string; // Client Order ID
  Side: "1" | "2"; // 1=Buy, 2=Sell
  TransactTime: string; // Order creation time
  OrdType: "1" | "2" | "3" | "4"; // Market, Limit, Stop, Stop Limit
  Price?: number; // Required for Limit orders
  StopPx?: number; // Required for Stop orders
  OrderQty: number; // Order quantity
  TimeInForce: "0" | "1" | "2" | "3" | "4" | "5" | "6"; // GTC, IOC, FOK, etc.
  Symbol: string; // Trading pair
  SecurityType: string; // Type of security
  SecurityExchange: string; // Exchange identifier
}
```

### 2. Order Cancel Request (F)

```typescript
interface OrderCancelRequest {
  OrigClOrdID: string; // Original Client Order ID
  ClOrdID: string; // New Client Order ID
  Side: "1" | "2"; // 1=Buy, 2=Sell
  TransactTime: string; // Cancel request time
  OrderID: string; // Exchange Order ID
  Symbol: string; // Trading pair
  SecurityType: string; // Type of security
  SecurityExchange: string; // Exchange identifier
}
```

### 3. Order Cancel Replace Request (G)

```typescript
interface OrderCancelReplaceRequest {
  OrigClOrdID: string; // Original Client Order ID
  ClOrdID: string; // New Client Order ID
  Side: "1" | "2"; // 1=Buy, 2=Sell
  TransactTime: string; // Replace request time
  OrderID: string; // Exchange Order ID
  OrdType: "1" | "2" | "3" | "4"; // Market, Limit, Stop, Stop Limit
  Price?: number; // New price for Limit orders
  StopPx?: number; // New stop price for Stop orders
  OrderQty: number; // New order quantity
  TimeInForce: "0" | "1" | "2" | "3" | "4" | "5" | "6"; // GTC, IOC, FOK, etc.
  Symbol: string; // Trading pair
  SecurityType: string; // Type of security
  SecurityExchange: string; // Exchange identifier
}
```

### 4. Execution Report (8)

```typescript
interface ExecutionReport {
  OrderID: string; // Exchange Order ID
  ClOrdID: string; // Client Order ID
  OrigClOrdID?: string; // Original Client Order ID
  ExecID: string; // Execution ID
  ExecType: string; // Execution type (New, Trade, Canceled, etc.)
  OrdStatus: string; // Order status
  Side: "1" | "2"; // 1=Buy, 2=Sell
  LeavesQty: number; // Remaining quantity
  CumQty: number; // Filled quantity
  AvgPx: number; // Average price
  Symbol: string; // Trading pair
  SecurityType: string; // Type of security
  SecurityExchange: string; // Exchange identifier
  TransactTime: string; // Transaction time
  Text?: string; // Additional information
}
```

## Message Processing

### 1. Market Data Processing

```typescript
class MarketDataProcessor {
  processSnapshot(message: MarketDataSnapshot): void {
    // Update Redis cache with latest prices
    // Store historical data in TimescaleDB
    // Broadcast to WebSocket clients
  }

  processIncremental(message: MarketDataIncremental): void {
    // Update Redis cache with incremental changes
    // Update order book
    // Broadcast to WebSocket clients
  }
}
```

### 2. Order Processing

```typescript
class OrderProcessor {
  processNewOrder(message: NewOrderSingle): void {
    // Validate order parameters
    // Check risk limits
    // Send to exchange
    // Update order status
  }

  processExecutionReport(message: ExecutionReport): void {
    // Update order status
    // Update position
    // Trigger notifications
    // Update analytics
  }
}
```

## Message Validation

### 1. Market Data Validation

```typescript
function validateMarketDataRequest(request: MarketDataRequest): boolean {
  // Validate required fields
  // Check symbol format
  // Validate subscription type
  // Check market depth
  return true;
}
```

### 2. Order Validation

```typescript
function validateNewOrder(order: NewOrderSingle): boolean {
  // Validate required fields
  // Check price limits
  // Validate quantity
  // Check symbol
  // Validate time in force
  return true;
}
```

## Error Handling

### 1. Market Data Errors

```typescript
interface MarketDataError {
  MDReqID: string;
  ErrorCode: string;
  ErrorMsg: string;
  Symbol?: string;
  SecurityType?: string;
  SecurityExchange?: string;
}
```

### 2. Order Errors

```typescript
interface OrderError {
  ClOrdID: string;
  OrderID?: string;
  ErrorCode: string;
  ErrorMsg: string;
  Symbol?: string;
  Side?: "1" | "2";
  OrdType?: "1" | "2" | "3" | "4";
}
```

## Message Logging

### 1. Message Logging Configuration

```typescript
interface MessageLogConfig {
  enabled: boolean;
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  path: string;
  retention: number; // days
}
```

### 2. Message Logging Implementation

```typescript
class MessageLogger {
  logMessage(direction: "incoming" | "outgoing", message: any): void {
    // Format message
    // Add metadata
    // Write to log file
    // Update metrics
  }
}
```

## Performance Optimization

### 1. Message Batching

```typescript
class MessageBatcher {
  private batch: any[] = [];
  private batchSize: number;
  private batchTimeout: number;

  addMessage(message: any): void {
    this.batch.push(message);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  flush(): void {
    // Process batch
    // Send to exchange
    // Clear batch
  }
}
```

### 2. Message Caching

```typescript
class MessageCache {
  private cache: Map<string, any>;
  private ttl: number;

  set(key: string, value: any): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
}
```

## Testing

### 1. Message Testing

```typescript
describe("FIX Messages", () => {
  test("Market Data Request", () => {
    const request = createMarketDataRequest();
    expect(validateMarketDataRequest(request)).toBe(true);
  });

  test("New Order Single", () => {
    const order = createNewOrderSingle();
    expect(validateNewOrder(order)).toBe(true);
  });
});
```

### 2. Integration Testing

```typescript
describe("FIX Integration", () => {
  test("Market Data Flow", async () => {
    // Send market data request
    // Receive snapshot
    // Receive incremental updates
    // Verify data
  });

  test("Order Flow", async () => {
    // Send new order
    // Receive execution report
    // Verify order status
    // Check position updates
  });
});
```
