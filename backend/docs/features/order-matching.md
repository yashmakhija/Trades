# Order Matching System

The Trading App implements a simplified order matching and execution system that simulates real market behavior while providing a controlled trading environment. This document provides a comprehensive explanation of how orders are processed, matched, and executed within the platform.

## Table of Contents

- [Order Matching System](#order-matching-system)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Order Flow Architecture](#order-flow-architecture)
  - [Order Types](#order-types)
    - [Market Orders](#market-orders)
    - [Limit Orders with Stop-Loss and Take-Profit](#limit-orders-with-stop-loss-and-take-profit)
  - [Order Matching Process](#order-matching-process)
    - [Flow Diagram](#flow-diagram)
  - [Price Discovery Mechanism](#price-discovery-mechanism)
  - [Order Execution](#order-execution)
  - [Risk Management](#risk-management)
    - [Balance Reservation](#balance-reservation)
    - [Stop-Loss and Take-Profit Triggers](#stop-loss-and-take-profit-triggers)
  - [Balance Management](#balance-management)
  - [Performance Considerations](#performance-considerations)
  - [Future Enhancements](#future-enhancements)

## Overview

The order matching system simulates a simplified market exchange by using real-time price data from Binance as the source of truth for order execution. Unlike a traditional exchange that matches buyer and seller orders directly, our system executes orders against the current market price, providing a realistic trading experience without the complexity of a full order book.

Key characteristics of our order matching system:

- **Price-Based Execution**: Orders are executed based on the current market price from Binance
- **Real-Time Processing**: Stop-loss and take-profit orders are triggered in real-time
- **In-Memory Management**: Active orders are kept in memory for fast processing
- **Persistent Storage**: All order data is stored in a database for reliability
- **Event-Driven Architecture**: The system uses events to communicate between components

## Order Flow Architecture

The order matching system is composed of several key components that work together:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  API Layer  │─────▶│OrderController│─────▶│ OrderManager │
└─────────────┘      └─────────────┘      └──────┬──────┘
                                                ▲│
                                                │▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│WebSocket API│◀─────│WebSocketSvc │◀─────│BalanceManager│
└─────────────┘      └─────────────┘      └─────────────┘
                           ▲
                           │
                    ┌──────┴──────┐
                    │BinanceService│
                    └─────────────┘
```

- **OrderController**: Handles REST API requests for placing and canceling orders
- **OrderManager**: Core service that manages order lifecycle and execution
- **BalanceManager**: Handles user balance updates and reservations
- **BinanceService**: Fetches real-time price data from Binance
- **WebSocketService**: Broadcasts order and balance updates to clients

## Order Types

The system supports the following order types:

### Market Orders

Market orders are executed immediately at the current market price:

```typescript
// Example market order
{
  symbolId: "btc-usdt-id",
  type: "BUY",
  price: 8400000, // $84,000.00 (stored as integer cents)
  quantity: 100,  // 0.01 BTC (quantity * 10000)
  isShort: false
}
```

### Limit Orders with Stop-Loss and Take-Profit

The system also supports limit orders with optional stop-loss and take-profit parameters:

```typescript
// Example limit order with stop-loss and take-profit
{
  symbolId: "btc-usdt-id",
  type: "BUY",
  price: 8400000,    // $84,000.00
  quantity: 100,     // 0.01 BTC
  stopLoss: 8200000, // $82,000.00
  takeProfit: 8600000, // $86,000.00
  isShort: false
}
```

## Order Matching Process

The order matching process follows these steps:

1. **Order Placement**: User submits an order via the API
2. **Balance Check**: System verifies user has sufficient balance
3. **Order Creation**: Order is stored in database and added to in-memory maps
4. **Price Monitoring**: System continuously monitors price updates from Binance
5. **Trigger Detection**: For each price update, the system checks if any stop-loss or take-profit conditions are met
6. **Order Execution**: When conditions are met, the order is executed

### Flow Diagram

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │───▶│  API    │───▶│ Create  │───▶│ Monitor │───▶│ Execute │
│ Request │    │ Endpoint│    │  Order  │    │  Price  │    │  Order  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                  ▲
                                                  │
                                            ┌─────────┐
                                            │ Binance │
                                            │  Data   │
                                            └─────────┘
```

## Price Discovery Mechanism

Rather than maintaining a full order book, our system uses Binance's real-time market data as the source of truth for price discovery:

1. **WebSocket Connection**: Maintains a WebSocket connection to Binance to receive real-time price updates
2. **Multiple Data Sources**: Processes ticker data, trade data, and candlestick data
3. **Price Normalization**: Converts string prices to integer representation (multiplied by 100)
4. **Trigger Checking**: For each price update, the system checks if any order triggers should be activated

```typescript
// Example of price trigger checking
function handleWebSocketMessage(message: WebSocket.Data): void {
  // Process Binance WebSocket message
  if (data.e === "ticker") {
    const tickerData = processTickerData(data);

    // Check for stop-loss and take-profit triggers with the latest price
    orderManager.checkPriceTriggers(tickerData.symbol, tickerData.price);

    // Broadcast price update to clients
    broadcastTickerUpdate(tickerData.symbol, tickerData);
  }
}
```

## Order Execution

When a trigger condition is met, the order execution process begins:

1. **Execution Price**: The current market price is used as the execution price
2. **PnL Calculation**: Profit or loss is calculated based on entry and exit prices
3. **Order Status Update**: Order status is updated to CLOSED in the database
4. **Balance Update**: User's balance is updated to reflect the transaction
5. **Order Cleanup**: Order is removed from in-memory collections
6. **Notification**: Order execution is broadcast to the user via WebSocket

```typescript
private async executeOrder(
  orderId: string,
  price: number,
  triggerType: "MARKET" | "STOP_LOSS" | "TAKE_PROFIT"
): Promise<void> {
  // Calculate PnL
  const pnl = this.calculatePnL(order, price);

  // Update order in database
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CLOSED,
      exitPrice: price,
      pnl,
      closedAt: new Date(),
    },
  });

  // Update user's balance
  await balanceManager.updateBalanceAfterExecution(
    order.userId,
    orderId,
    order.symbolName,
    order.quantity,
    price,
    order.type
  );

  // Broadcast updates to client
  broadcastOrderUpdate(order.userId, {
    type: "ORDER_CLOSED",
    data: {
      orderId,
      exitPrice: price,
      pnl,
      triggerType,
    },
  });
}
```

## Risk Management

The system implements several risk management features:

### Balance Reservation

When an order is placed, the system reserves the required amount from the user's balance:

```typescript
// Calculate required balance
const requiredAmount = orderData.price * orderData.quantity;

// Reserve the balance
await balanceManager.reserveBalance(orderData.userId, order.id, requiredAmount);
```

### Stop-Loss and Take-Profit Triggers

Stop-loss and take-profit orders are automatically triggered when price conditions are met:

```typescript
private shouldTriggerStopLoss(order: Order, currentPrice: number): boolean {
  if (!order.stopLoss) return false;

  if (order.type === OrderType.BUY && !order.isShort) {
    // Long position - trigger if price falls below stop loss
    return currentPrice <= order.stopLoss;
  } else if (order.type === OrderType.SELL && order.isShort) {
    // Short position - trigger if price rises above stop loss
    return currentPrice >= order.stopLoss;
  }

  return false;
}
```

## Balance Management

The balance management system handles user funds throughout the order lifecycle:

1. **Initial Check**: Verifies user has sufficient balance to place an order
2. **Balance Reservation**: Reserves funds when an order is placed
3. **Balance Release**: Releases reserved funds when an order is canceled
4. **Balance Update**: Updates balance after order execution, considering profit or loss

```typescript
async reserveBalance(
  userId: string,
  orderId: string,
  amount: number
): Promise<boolean> {
  // Get current balance
  const balance = await this.getUserBalance(userId);

  // Check if user has enough available balance
  if (balance.available < amount) {
    return false;
  }

  // Reserve the amount
  this.reservedBalances.set(
    `${userId}:${orderId}`,
    { amount, timestamp: Date.now() }
  );

  // Update available balance
  await this.updateAvailableBalance(userId);

  return true;
}
```

## Performance Considerations

The order matching system is designed for performance:

- **In-Memory Data Structures**: Active orders are kept in memory for fast access
- **Indexed Collections**: Orders are indexed by user ID, symbol, and order ID
- **Efficient Lookups**: O(1) lookups for stop-loss and take-profit checks
- **Optimized Price Checks**: Not every price update triggers a database operation
- **Batched Updates**: Multiple related updates are batched when possible

## Future Enhancements

Potential future enhancements to the order matching system:

1. **Order Book Simulation**: Implement a full order book for more realistic price discovery
2. **Matching Engine**: Develop a true matching engine to match buyers and sellers
3. **Advanced Order Types**: Support for more advanced order types (OCO, trailing stops, etc.)
4. **Scalability Improvements**: Horizontal scaling for higher throughput
5. **Market Makers**: Automated market makers to provide liquidity

---

This document provides a high-level overview of the order matching system. For implementation details, please refer to the source code in the following files:

- `src/services/orderManager.ts` - Core order management logic
- `src/services/balanceManager.ts` - Balance management functionality
- `src/services/binanceService.ts` - Price data source
- `src/controllers/orderController.ts` - API entry points
