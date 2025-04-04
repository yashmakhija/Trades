#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Check if FIXParser license key is set
if [ -z "$FIXPARSER_LICENSE_KEY" ]; then
    echo "Error: FIXPARSER_LICENSE_KEY is not set"
    exit 1
fi

# Print current configuration
echo "Current FIX Server Location: $FIX_SERVER_LOCATION"
echo "Pricing Server: $FIX_PRICING_HOST:$FIX_PRICING_PORT"
echo "Trading Server: $FIX_TRADING_HOST:$FIX_TRADING_PORT"

# Network diagnostics
echo "Running network diagnostics..."

# Check server reachability
echo "Pinging FIX server..."
ping -c 4 $FIX_PRICING_HOST

# Check DNS resolution
echo "Checking DNS resolution..."
dig +short $FIX_PRICING_HOST

# Check traceroute to understand network path
echo "Running traceroute to understand network path..."
traceroute -n -w 1 -q 1 $FIX_PRICING_HOST

# Check port connectivity with timeout
echo "Checking port connectivity with increased timeout..."
nc -zv -w 10 $FIX_PRICING_HOST $FIX_PRICING_PORT
nc -zv -w 10 $FIX_TRADING_HOST $FIX_TRADING_PORT

# Check SSL connectivity for trading port
if [ "$FIX_TRADING_USE_SSL" = "true" ]; then
    echo "Checking SSL connectivity with detailed output..."
    openssl s_client -connect $FIX_TRADING_HOST:$FIX_TRADING_PORT -servername $FIX_TRADING_HOST -tls1_2
fi

# Check if we can resolve the server's SSL certificate
echo "Checking SSL certificate information..."
openssl s_client -connect $FIX_TRADING_HOST:$FIX_TRADING_PORT -servername $FIX_TRADING_HOST -tls1_2 </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates

# Run the tests
echo "Running FIX connection tests..."
jest --config jest.config.js src/test/fix/connection.test.ts --verbose --detectOpenHandles --forceExit --testTimeout=300000 