# 100x Trading Platform - Frontend

This is a modern trading platform built with Next.js, React, TypeScript, and TailwindCSS. The application provides real-time market data, trading capabilities, and account management features.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Recent Fixes

### WebSocket and OrderList Fixes (March 2025)

We've recently fixed critical issues with the WebSocket implementation and OrderList component:

1. **WebSocket Data Handling**: Fixed an error where candle data wasn't properly initialized for new symbols or timeframes, causing `TypeError: existingData[get.activeTimeframe] is not iterable`.

2. **OrderList Component**: Improved error handling in the OrderList component to properly handle invalid API responses, fixing `TypeError: allOrders.filter is not a function`.

3. **API Response Validation**: Enhanced the orders service to validate API responses and ensure they always return the expected data format.

For detailed information about these fixes, see [WebSocket Fixes Documentation](./docs/WEBSOCKET-FIXES.md).

## Application Architecture

The frontend is built with a modern tech stack:

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS with shadcn/ui components
- **State Management**: Zustand for global state
- **Real-time Data**: WebSocket for live market data
- **Charts**: Lightweight Charts (TradingView) for price visualization

### Directory Structure

```
frontend/src/
├── app/                  # Next.js App Router pages
│   ├── api/              # API routes for server-side operations
│   ├── login/            # Authentication pages
│   ├── profile/          # User profile management
│   ├── register/         # User registration
│   ├── trading/          # Trading dashboard
│   └── markets/          # Market overview
├── components/           # React components
│   ├── layout/           # Layout components (navbar, footer)
│   ├── providers/        # Context providers
│   ├── sections/         # Page sections
│   ├── trading/          # Trading-specific components
│   └── ui/               # UI components (buttons, cards, etc.)
├── config/               # Application configuration
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and helpers
├── services/             # API services and data fetching
│   ├── auth.ts           # Authentication service
│   ├── marketData.ts     # Market data service
│   ├── orders.ts         # Order management service
│   └── websocket.ts      # WebSocket service for real-time data
└── store/                # Global state management with Zustand
```

## Development Phases

The application is being developed in several phases:

### Phase 1: Core Infrastructure ✅

- Setup Next.js with TypeScript and TailwindCSS
- Implement basic UI components with shadcn/ui
- Create responsive layouts
- Setup global state management with Zustand

### Phase 2: Authentication System ✅

- Implement user registration and login
- Create authentication store and service
- Add protected routes
- Develop user profile management

### Phase 3: Market Data Integration ✅

- Implement market data service
- Create WebSocket connection for real-time data
- Build price chart with TradingView's Lightweight Charts
- Add market ticker and symbol selector

### Phase 4: Trading Functionality ✅

- Implement order form for market and limit orders
- Create order history and management
- Add balance display and management
- Implement order execution service

### Phase 5: Advanced Features 🔄

- Add advanced chart indicators
- Implement order book visualization
- Create portfolio performance tracking
- Add notifications for order execution and price alerts

### Phase 6: Optimization and Polish ⏳

- Performance optimization
- Accessibility improvements
- Comprehensive error handling
- Enhanced mobile experience

## Key Features

1. **Real-time Market Data**

   - WebSocket connection for live price updates
   - Candlestick charts with multiple timeframes
   - Market ticker with price and volume information

2. **Trading Capabilities**

   - Market and limit orders
   - Order history and management
   - Balance tracking

3. **User Management**

   - Registration and login
   - Profile management
   - Demo account with virtual balance

4. **Responsive Design**
   - Mobile-friendly interface
   - Adaptive layouts for different screen sizes

## Current Focus Areas

The current development focus is on:

1. **WebSocket Stability**

   - Ensuring reliable real-time data connection
   - Implementing reconnection logic
   - Optimizing data processing for performance

2. **Chart Enhancements**

   - Adding technical indicators
   - Improving chart responsiveness
   - Supporting more timeframes

3. **Order Execution**
   - Streamlining the order process
   - Improving error handling
   - Adding order confirmation and feedback

## Remaining Tasks

The following features are planned for future implementation:

1. **Order Book Visualization**

   - Depth chart for buy/sell orders
   - Real-time order book updates

2. **Advanced Trading Features**

   - Stop-loss and take-profit orders
   - Trailing stops
   - OCO (One Cancels Other) orders

3. **Portfolio Analytics**

   - Performance tracking
   - P&L visualization
   - Trade history analytics

4. **User Preferences**

   - Customizable UI themes
   - Chart preferences
   - Notification settings

5. **Mobile Optimization**
   - Touch-friendly controls
   - Gesture support for charts
   - Mobile-specific layouts

## Workflow

The development workflow follows these steps:

1. **Feature Planning**

   - Define requirements and acceptance criteria
   - Create mockups and wireframes
   - Plan API integration

2. **Implementation**

   - Develop UI components
   - Implement business logic
   - Connect to backend services

3. **Testing**

   - Unit testing with Jest
   - Integration testing
   - Manual testing for UI/UX

4. **Deployment**
   - Build optimization
   - Performance testing
   - Staged rollout

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## WebSocket Timeframe Handling

The trading application uses a custom WebSocket implementation to handle real-time market data and candle updates. Here's how the timeframe handling works:

### Symbol + Timeframe Subscriptions

- The WebSocket service tracks both symbols AND timeframes that each client is subscribed to
- We maintain a `subscribedTimeframes` map that stores which timeframes each client is interested in for each symbol
- This prevents sending unnecessary updates to clients for timeframes they don't care about

### Timeframe Conversion

- The backend sends timeframes in enum format (`ONE_MINUTE`, `FIVE_MINUTES`, etc.)
- The frontend uses shorthand format (`1m`, `5m`, `15m`, etc.)
- The WebSocket service automatically converts between these formats

### Optimized Updates

- The system filters updates based on subscriptions - clients only receive updates for the timeframes they've explicitly subscribed to
- When switching timeframes in the PriceChart component, we:
  1. Check if we're already subscribed to the new timeframe
  2. If not, subscribe to it before changing the UI
  3. Show a loading state during the transition
  4. Debounce updates right after a timeframe change to prevent flickering

### Improved Candle Processing

- We normalize all timestamps to Unix timestamp in seconds (required by the chart library)
- Price normalization automatically converts between backend integer format (cents) and frontend decimal format (dollars)
- Real-time updates intelligently update both candle data and ticker prices

### Resource Management

- Components properly clean up their subscriptions when unmounting
- We maintain active subscriptions when components remount to avoid data loss
- The backend aggregates higher timeframes (5m, 15m, 1h, etc.) from 1-minute data, which is more efficient than subscribing to multiple WebSocket streams

This architecture provides a balance between real-time updates and performance, ensuring that the UI remains responsive while displaying accurate market data across all timeframes.
