# Docker Setup and Workflow

This document provides a comprehensive guide for setting up and working with Docker in the Trading App environment.

## Overview

The Trading App uses Docker to create a consistent development and production environment. The setup consists of:

1. A backend service built with Node.js/Bun
2. A TimescaleDB service for time-series data storage

## Project Structure

```
backend/
├── Dockerfile        # Production-ready Dockerfile for the backend service
├── docker-compose.yml # Configuration for the multi-container setup
└── ...
```

## Dockerfile

Our Dockerfile follows best practices for Node.js/Bun applications:

- **Multi-stage build** for smaller production images
- **Non-root user** for enhanced security
- **Health checks** for improved reliability
- **Clean & minimal** design for maintainability

```dockerfile
# Stage 1: Build stage
FROM oven/bun:1.0.30 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy source code and generate Prisma client
COPY . .
RUN bunx prisma generate

# Stage 2: Production stage
FROM oven/bun:1.0.30 AS production
WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./

# Set permissions
RUN chown -R bun:bun /app

# Basic environment variables
ENV PORT=3001 \
    NODE_ENV=production

# Create healthcheck script
RUN echo '#!/bin/sh\ncurl -f http://localhost:${PORT:-3001}/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Expose port
EXPOSE 3001

# Set health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["/app/healthcheck.sh"]

# Set non-root user
USER bun

# Set entrypoint - Direct execution with database waiting handled by the app
CMD ["bun", "src/index.ts"]
```

## Docker Compose Configuration

The `docker-compose.yml` file coordinates the services:

```yaml
version: "3.8"

services:
  # TimescaleDB with PostGIS extension
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading_app
    volumes:
      - timescale_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - trading-network

  # Trading app backend
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: trading-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@timescaledb:5432/trading_app?schema=public
      - PORT=3001
      - JWT_SECRET=super-secure-jwt-secret-for-development
      - JWT_EXPIRES_IN=7d
      - BINANCE_WEBSOCKET_URL=wss://stream.binance.com:9443/ws
      - TRADING_SYMBOLS=btcusdt,ethusdt,bnbusdt,solusdt,adausdt
    depends_on:
      timescaledb:
        condition: service_healthy
    networks:
      - trading-network

volumes:
  timescale_data:
    driver: local

networks:
  trading-network:
    driver: bridge
```

## Core Features

1. **Networked Containers**: Both services communicate on the same network
2. **Persistent Data**: TimescaleDB data preserved between container restarts
3. **Environment Variables**: Properly configured for each environment
4. **Health Checks**: Ensures service availability
5. **Dependency Management**: Backend depends on database

## Common Commands

### Basic Operations

```bash
# Start containers in detached mode
docker-compose up -d

# Stop containers
docker-compose down

# Stop containers and remove volumes
docker-compose down -v

# Build containers
docker-compose build

# Build containers without using cache
docker-compose build --no-cache

# Restart specific service
docker-compose restart backend
```

### Troubleshooting

```bash
# View container logs
docker logs trading-backend

# Check container status
docker ps

# Access container shell
docker exec -it trading-backend /bin/sh

# Check database connection
docker exec -it backend-timescaledb-1 psql -U postgres -d trading_app
```

## Development Workflow

1. **Clone Repository**: Get the latest code
2. **Start Services**: Run `docker-compose up -d`
3. **Make Changes**: Edit code as needed
4. **Rebuild**: If Dockerfile or package.json changes, run `docker-compose build backend`
5. **Restart Services**: Apply changes with `docker-compose restart backend`

## Production Deployment

For production deployment:

1. Set secure environment variables in a production-only .env file
2. Remove development-only settings
3. Use a reverse proxy (like Nginx) for SSL termination
4. Consider using Docker Swarm or Kubernetes for container orchestration

## Database Schema Migration

When schema changes occur:

1. Update your Prisma schema
2. Rebuild backend service: `docker-compose build backend`
3. Restart backend service: `docker-compose restart backend`
4. Migrations will be applied automatically on startup

## Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Check the DATABASE_URL environment variable
   - Ensure network connectivity between containers
   - Verify that the database is running

2. **Container Won't Start**

   - Examine logs: `docker logs trading-backend`
   - Verify environment variables are correct
   - Check permissions on mounted volumes

3. **TimescaleDB Extension Issues**
   - Connect to database: `docker exec -it backend-timescaledb-1 psql -U postgres -d trading_app`
   - Check extensions: `\dx`
   - Create extension if needed: `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`

## Best Practices

1. **Use multi-stage builds** to minimize image size
2. **Run containers as non-root users** for security
3. **Implement health checks** for all services
4. **Keep environment variables separate** from source code
5. **Use volumes for persistent data**
6. **Network services appropriately** for isolation
7. **Set resource limits** in production environments
