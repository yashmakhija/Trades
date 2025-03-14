# Trading Platform Tests

This directory contains tests for the Trading Platform backend. The tests are organized by type and functionality to ensure comprehensive coverage of the application.

## Test Structure

- **Unit Tests**: Test individual components in isolation

  - `auth.test.ts`: Tests for authentication routes
  - `order.test.ts`: Tests for order routes
  - `symbol.test.ts`: Tests for symbol routes
  - `middleware/auth.test.ts`: Tests for authentication middleware

- **Service Tests**: Test service layer functionality

  - `services/orderManager.test.ts`: Tests for the OrderManager service
  - `services/balanceManager.test.ts`: Tests for the BalanceManager service

- **Integration Tests**: Test complete workflows across multiple components
  - `integration/trading-workflow.test.ts`: Tests the complete trading workflow

## Running Tests

To run all tests:

```bash
bun test
```

To run tests in watch mode (automatically re-run when files change):

```bash
bun test --watch
```

To run a specific test file:

```bash
bun test src/tests/auth.test.ts
```

## Test Coverage

The tests cover:

1. **Authentication**: User registration, login, and profile retrieval
2. **Order Management**: Order placement, cancellation, and retrieval
3. **Symbol Information**: Symbol listing and price updates
4. **Trading Logic**: Stop-loss and take-profit triggers
5. **Balance Management**: Balance reservation, release, and updates
6. **Integration**: Complete trading workflows from user registration to order execution

## Mocking Strategy

- **External Services**: WebSocket connections and Binance API calls are mocked
- **Database**: Uses the actual Prisma client but with test-specific data
- **Authentication**: JWT tokens are generated for testing purposes

## Test Data Cleanup

All tests are designed to clean up after themselves by:

- Deleting test users
- Removing test orders
- Cleaning up test symbols

This ensures that tests can be run repeatedly without interference from previous test runs.
