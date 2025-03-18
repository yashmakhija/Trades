FROM oven/bun:1.0 as builder

WORKDIR /app

# Copy package.json and related files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Production stage
FROM oven/bun:1.0

WORKDIR /app

# Copy from build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/.env.example ./.env.example

# Create an entrypoint script
RUN echo '#!/bin/bash \n\
\n\
# Check if .env file exists \n\
if [ ! -f .env ]; then \n\
  echo "Creating .env file from .env.example..." \n\
  cp .env.example .env \n\
  echo "Please update environment variables using runtime configuration." \n\
fi \n\
\n\
# Wait for database to be ready \n\
echo "Waiting for database to be ready..." \n\
bun src/scripts/wait-for-db.js \n\
\n\
# Run database migrations \n\
echo "Running database migrations..." \n\
bunx prisma db push \n\
\n\
# Initialize the database with default values \n\
echo "Initializing database..." \n\
bun src/scripts/initDb.ts \n\
\n\
# Check and setup TimescaleDB extension if needed \n\
echo "Checking TimescaleDB extension..." \n\
bun db:check-timescale \n\
\n\
# Start the server \n\
echo "Starting server..." \n\
bun src/index.ts \n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Create wait-for-db script
RUN mkdir -p /app/src/scripts && echo 'import { PrismaClient } from "@prisma/client"; \n\
import dotenv from "dotenv"; \n\
\n\
dotenv.config(); \n\
\n\
const MAX_RETRIES = 30; \n\
const RETRY_DELAY = 2000; \n\
\n\
async function waitForDatabase() { \n\
  const prisma = new PrismaClient(); \n\
  let retries = 0; \n\
\n\
  while (retries < MAX_RETRIES) { \n\
    try { \n\
      console.log(`Attempt ${retries + 1}/${MAX_RETRIES} to connect to database...`); \n\
      await prisma.$connect(); \n\
      console.log("Successfully connected to database!"); \n\
      await prisma.$disconnect(); \n\
      return; \n\
    } catch (error) { \n\
      console.log(`Database not ready yet: ${error.message}`); \n\
      retries++; \n\
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); \n\
    } \n\
  } \n\
\n\
  console.error("Failed to connect to database after maximum retries"); \n\
  process.exit(1); \n\
} \n\
\n\
waitForDatabase(); \n\
' > /app/src/scripts/wait-for-db.js

# Expose the port the app runs on
EXPOSE 3001

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Run the application
ENTRYPOINT ["/app/docker-entrypoint.sh"] 