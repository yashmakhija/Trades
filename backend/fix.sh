#!/bin/bash

# Function to check if a command succeeded
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error: $1 failed"
    if [ "$2" = "critical" ]; then
      echo "This is a critical error. Exiting..."
      exit 1
    fi
  fi
}

# Stop any running processes
echo "Stopping any running processes..."
pkill -f "bun --watch src/index.ts" || true

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Creating from example..."
  cp .env.example .env
  echo "Please update the DATABASE_URL in .env file with your database credentials."
  exit 1
fi

# Generate Prisma client
echo "Generating Prisma client..."
bun db:generate
check_command "Generating Prisma client"

# Check database connection
echo "Checking database connection..."
DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2)

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in .env file"
  echo "Please set a valid DATABASE_URL in your .env file"
  exit 1
fi

# Try to push schema to database
echo "Pushing schema to database..."
bun db:push

# If db:push fails, provide helpful message
if [ $? -ne 0 ]; then
  echo "Database connection failed. This could be due to:"
  echo "1. The database server is not running"
  echo "2. The DATABASE_URL in .env is incorrect"
  echo "3. Network connectivity issues"
  echo ""
  echo "For development, you can use SQLite instead by updating your .env file:"
  echo "DATABASE_URL=\"file:./dev.db\""
  echo ""
  echo "Would you like to continue with initializing the database? (y/n)"
  read -r answer
  if [ "$answer" != "y" ]; then
    echo "Exiting..."
    exit 1
  fi
fi

# Initialize database with symbols
echo "Initializing database with symbols..."
bun db:init
check_command "Initializing database"

# Check if public directory exists
if [ ! -d "src/public" ]; then
  echo "Creating public directory..."
  mkdir -p src/public
fi

# Check if websocket-client-example.html exists and has content
if [ ! -s "src/public/websocket-client-example.html" ]; then
  echo "WebSocket client example is empty or missing. Please check the file."
fi

# Start the application
echo "Starting the application..."
echo "The application will be available at:"
echo "- API: http://localhost:3001/api"
echo "- API Documentation: http://localhost:3001/api-docs"
echo "- WebSocket Client Example: http://localhost:3001/websocket-client-example.html"
echo ""
bun dev 