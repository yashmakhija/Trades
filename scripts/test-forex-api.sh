#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Base URL
BASE_URL="http://localhost:3001/api/forex"

# Test exchange rate endpoint
echo -e "\n${GREEN}Testing exchange rate endpoint...${NC}"
curl -s "${BASE_URL}/rate?fromCurrency=EUR&toCurrency=USD" | jq .

# Test daily forex data endpoint
echo -e "\n${GREEN}Testing daily forex data endpoint...${NC}"
curl -s "${BASE_URL}/daily?fromCurrency=EUR&toCurrency=USD" | jq .

# Test intraday forex data endpoint
echo -e "\n${GREEN}Testing intraday forex data endpoint...${NC}"
curl -s "${BASE_URL}/intraday?fromCurrency=EUR&toCurrency=USD&interval=5min" | jq .

# Test error handling - missing parameters
echo -e "\n${GREEN}Testing error handling - missing parameters...${NC}"
curl -s "${BASE_URL}/rate" | jq .

# Test error handling - invalid currency
echo -e "\n${GREEN}Testing error handling - invalid currency...${NC}"
curl -s "${BASE_URL}/rate?fromCurrency=INVALID&toCurrency=USD" | jq .

# Test different intervals for intraday
echo -e "\n${GREEN}Testing different intervals for intraday data...${NC}"
for interval in "1min" "5min" "15min" "30min" "60min"; do
    echo -e "\nTesting interval: ${interval}"
    curl -s "${BASE_URL}/intraday?fromCurrency=EUR&toCurrency=USD&interval=${interval}" | jq .
done

# Test different currency pairs
echo -e "\n${GREEN}Testing different currency pairs...${NC}"
for pair in "GBP/USD" "JPY/USD" "AUD/USD"; do
    IFS='/' read -r from to <<< "$pair"
    echo -e "\nTesting pair: ${pair}"
    curl -s "${BASE_URL}/rate?fromCurrency=${from}&toCurrency=${to}" | jq .
done 