#!/bin/bash
set -e

echo "Initializing database with sample data..."

# Wait for the database to be ready
if ! pg_isready -h timescaledb -U postgres; then
  echo "Database is not ready. Please make sure TimescaleDB is running."
  exit 1
fi

# Connect to database
PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -c "SELECT 'Database connection successful' as status;"

# Check if Symbol table exists
SYMBOL_TABLE_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Symbol');" 2>/dev/null || echo "f")
SYMBOL_TABLE_EXISTS=$(echo $SYMBOL_TABLE_EXISTS | tr -d ' ')

if [ "$SYMBOL_TABLE_EXISTS" = "t" ]; then
  echo "Symbol table exists, checking for data..."
  
  # Check if Symbol table has data
  SYMBOL_COUNT=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT COUNT(*) FROM \"Symbol\";" 2>/dev/null || echo "0")
  SYMBOL_COUNT=$(echo $SYMBOL_COUNT | tr -d ' ')

  if [ "$SYMBOL_COUNT" = "0" ]; then
    echo "Symbol table exists but is empty. Initializing with sample data..."
    
    # Create symbols
    PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app << EOF
    INSERT INTO "Symbol" (id, name, description, "currentPrice", "createdAt", "updatedAt") 
    VALUES 
      (gen_random_uuid(), 'btcusdt', 'Bitcoin / USDT', 50000, NOW(), NOW()),
      (gen_random_uuid(), 'ethusdt', 'Ethereum / USDT', 3000, NOW(), NOW()),
      (gen_random_uuid(), 'bnbusdt', 'Binance Coin / USDT', 300, NOW(), NOW()),
      (gen_random_uuid(), 'solusdt', 'Solana / USDT', 100, NOW(), NOW()),
      (gen_random_uuid(), 'adausdt', 'Cardano / USDT', 1, NOW(), NOW())
    ON CONFLICT (name) DO UPDATE SET 
      description = EXCLUDED.description,
      "updatedAt" = NOW();
EOF
    echo "Symbol data initialized successfully!"
  else
    echo "Symbol table already contains $SYMBOL_COUNT symbols. Checking for missing symbols..."
    
    # Check and add any missing symbols
    for SYMBOL in "btcusdt:Bitcoin / USDT:50000" "ethusdt:Ethereum / USDT:3000" "bnbusdt:Binance Coin / USDT:300" "solusdt:Solana / USDT:100" "adausdt:Cardano / USDT:1"
    do
      SYMBOL_NAME=$(echo $SYMBOL | cut -d: -f1)
      SYMBOL_DESC=$(echo $SYMBOL | cut -d: -f2)
      SYMBOL_PRICE=$(echo $SYMBOL | cut -d: -f3)
      
      SYMBOL_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT COUNT(*) FROM \"Symbol\" WHERE name = '$SYMBOL_NAME';" 2>/dev/null || echo "0")
      SYMBOL_EXISTS=$(echo $SYMBOL_EXISTS | tr -d ' ')
      
      if [ "$SYMBOL_EXISTS" = "0" ]; then
        echo "Adding missing symbol: $SYMBOL_NAME"
        PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -c "INSERT INTO \"Symbol\" (id, name, description, \"currentPrice\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$SYMBOL_NAME', '$SYMBOL_DESC', $SYMBOL_PRICE, NOW(), NOW());"
      fi
    done
  fi
else
  echo "Symbol table does not exist. Skipping symbol initialization."
fi

# Check if User table exists
USER_TABLE_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User');" 2>/dev/null || echo "f")
USER_TABLE_EXISTS=$(echo $USER_TABLE_EXISTS | tr -d ' ')

if [ "$USER_TABLE_EXISTS" = "t" ]; then
  echo "User table exists, checking for data..."
  
  # Check if User table has data
  USER_COUNT=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
  USER_COUNT=$(echo $USER_COUNT | tr -d ' ')

  if [ "$USER_COUNT" = "0" ]; then
    echo "User table exists but is empty. Initializing with sample data..."
    
    # Create a demo user (password: password123)
    PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app << EOF
    INSERT INTO "User" (id, email, password, name, "usdcBalance", "createdAt", "updatedAt") 
    VALUES 
      (gen_random_uuid(), 'demo@example.com', '\$2b\$10\$eH.1IuDjHUh3V4kpJWQRxeZRUTvwKLqTAKdJ4hsEPPEwgcEEOANm6', 'Demo User', 1000000, NOW(), NOW()),
      (gen_random_uuid(), 'admin@example.com', '\$2b\$10\$eH.1IuDjHUh3V4kpJWQRxeZRUTvwKLqTAKdJ4hsEPPEwgcEEOANm6', 'Admin User', 5000000, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET 
      "updatedAt" = NOW();
EOF
    echo "User data initialized successfully!"
  else
    echo "User table already contains $USER_COUNT users. Ensuring demo users exist..."
    
    # Ensure demo users exist
    for USER in "demo@example.com:Demo User:1000000" "admin@example.com:Admin User:5000000"
    do
      USER_EMAIL=$(echo $USER | cut -d: -f1)
      USER_NAME=$(echo $USER | cut -d: -f2)
      USER_BALANCE=$(echo $USER | cut -d: -f3)
      
      USER_EXISTS=$(PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -t -c "SELECT COUNT(*) FROM \"User\" WHERE email = '$USER_EMAIL';" 2>/dev/null || echo "0")
      USER_EXISTS=$(echo $USER_EXISTS | tr -d ' ')
      
      if [ "$USER_EXISTS" = "0" ]; then
        echo "Adding demo user: $USER_EMAIL"
        PGPASSWORD=postgres psql -h timescaledb -U postgres -d trading_app -c "INSERT INTO \"User\" (id, email, password, name, \"usdcBalance\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$USER_EMAIL', '\$2b\$10\$eH.1IuDjHUh3V4kpJWQRxeZRUTvwKLqTAKdJ4hsEPPEwgcEEOANm6', '$USER_NAME', $USER_BALANCE, NOW(), NOW());"
      fi
    done
  fi
else
  echo "User table does not exist. Skipping user initialization."
fi

echo "All sample data has been verified and updated as needed!" 