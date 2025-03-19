# Data Model

The Trading App uses a PostgreSQL database with TimescaleDB extension for time-series data. The data model is defined using Prisma schema and consists of the following key entities:

## User Model

```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  password    String
  name        String?
  usdcBalance Int      @default(1000000)
  orders      Order[]
  balanceHistory BalanceHistory[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- **Purpose**: Represents user accounts in the system.
- **Key Fields**:
  - `id`: Unique identifier (UUID)
  - `email`: Unique email for authentication
  - `password`: Hashed password
  - `usdcBalance`: User's USDC balance (stored as integer, 1 USDC = 100 units)
- **Relationships**:
  - One-to-many with Orders
  - One-to-many with BalanceHistory

## Symbol Model

```prisma
model Symbol {
  id           String   @id @default(uuid())
  name         String   @unique
  description  String?
  currentPrice Int?
  orders       Order[]
  ohlcv        OHLCV[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- **Purpose**: Represents trading pairs/symbols (e.g., btcusdt).
- **Key Fields**:
  - `id`: Unique identifier (UUID)
  - `name`: Symbol name (unique)
  - `currentPrice`: Latest price (stored as integer, $1.00 = 100 units)
- **Relationships**:
  - One-to-many with Orders
  - One-to-many with OHLCV data

## Order Model

```prisma
model Order {
  id            String      @id @default(uuid())
  symbolId      String
  symbol        Symbol      @relation(fields: [symbolId], references: [id])
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  stopLoss      Int?
  takeProfit    Int?
  price         Int
  quantity      Int
  exitPrice     Int?
  pnl           Int?
  status        OrderStatus @default(CLOSED)
  type          OrderType
  isShort       Boolean     @default(false)
  parentOrderId String?
  parentOrder   Order?      @relation("LinkedOrders", fields: [parentOrderId], references: [id])
  childOrders   Order[]     @relation("LinkedOrders")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  closedAt      DateTime?
  reservedAmount Int?
  balanceHistory BalanceHistory[]
}
```

- **Purpose**: Tracks trading orders placed by users.
- **Key Fields**:
  - `id`: Unique identifier (UUID)
  - `price`: Entry price (integer format)
  - `quantity`: Order size
  - `stopLoss` & `takeProfit`: Optional price targets
  - `status`: Current order status (PENDING, OPEN, FILLED, CLOSED, CANCELLED)
  - `type`: Order type (BUY, SELL)
  - `isShort`: Whether this is a short position
  - `exitPrice` & `pnl`: Filled when order is closed
- **Relationships**:
  - Many-to-one with Symbol and User
  - Self-referencing relation for linked orders (stop-loss/take-profit)
  - One-to-many with BalanceHistory

## OHLCV Model (Candlestick Data)

```prisma
model OHLCV {
  id        String     @default(uuid())
  symbolId  String
  symbol    Symbol     @relation(fields: [symbolId], references: [id])
  open      Int
  high      Int
  low       Int
  close     Int
  volume    Int
  timeframe Timeframe  @default(ONE_MINUTE)
  time      DateTime   @default(now())

  @@id([id, time])
  @@index([symbolId, timeframe, time(sort: Desc)])
  @@index([time(sort: Desc)])
  @@index([symbolId])
  @@index([timeframe])
}
```

- **Purpose**: Stores time-series candlestick (OHLCV) data optimized for TimescaleDB.
- **Key Fields**:
  - Composite primary key `[id, time]` for TimescaleDB compatibility
  - `open`, `high`, `low`, `close`: Price data (integer format)
  - `volume`: Trading volume
  - `timeframe`: Candle period (ONE_MINUTE, FIVE_MINUTES, etc.)
- **Indexes**:
  - Optimized for time-series queries with multiple indexes

## BalanceHistory Model

```prisma
model BalanceHistory {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  amount      Int
  type        BalanceType
  description String
  orderId     String?
  order       Order?          @relation(fields: [orderId], references: [id])
  createdAt   DateTime        @default(now())

  @@index([userId, createdAt])
  @@index([orderId])
}
```

- **Purpose**: Tracks all changes to user balances for auditing and reporting.
- **Key Fields**:
  - `amount`: Change amount (integer format)
  - `type`: Transaction type (DEPOSIT, WITHDRAWAL, TRADE_OPEN, etc.)
  - `description`: Human-readable description
- **Relationships**:
  - Many-to-one with User
  - Optional many-to-one with Order

## Enums

The system uses several enums to constrain field values:

- **OrderType**: `BUY`, `SELL`
- **OrderStatus**: `PENDING`, `OPEN`, `FILLED`, `CLOSED`, `CANCELLED`
- **Timeframe**: `ONE_MINUTE`, `FIVE_MINUTES`, `TEN_MINUTES`, etc.
- **BalanceType**: `DEPOSIT`, `WITHDRAWAL`, `TRADE_OPEN`, `TRADE_CLOSE`, etc.

## Integer-Based Storage

All monetary values are stored as integers to avoid floating-point precision issues:

- 1 USDC = 100 units in storage
- $83,256.32 would be stored as 8325632
