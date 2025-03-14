#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "Please update the .env file with your database credentials."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Run database migrations
echo "Running database migrations..."
bun run db:push

# Start the server
echo "Starting the server..."
bun dev 