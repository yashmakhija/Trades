# Docker Setup Workflow

This document outlines the specific steps taken to set up and fix the Docker configuration for the Trading App, ensuring it works with a local TimescaleDB database.

## Initial Setup

The Trading App consists of two main services:

1. **Backend service**: A Node.js/Bun application
2. **TimescaleDB service**: A PostgreSQL database with TimescaleDB extension for time-series data

## Problem Identification

The initial configuration had several issues:

1. Docker container health checks were failing
2. The backend service couldn't connect to the database
3. The Dockerfile contained unnecessary scripts and complexity
4. Environment variables weren't being loaded correctly

## Step 1: Update Docker Compose Configuration

We first updated the `docker-compose.yml` file to ensure proper networking between services:

```yaml
# Updated docker-compose.yml
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

**Key changes:**

- Added explicit network configuration
- Updated database connection string to point to the TimescaleDB service
- Set up health checks for the database
- Established the dependency between services

## Step 2: Simplify the Dockerfile

We simplified the Dockerfile to make it more maintainable and production-ready:

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

**Key improvements:**

- Removed complex entrypoint script, letting the application handle database connections
- Maintained multi-stage build for optimized image size
- Kept health checks for container monitoring
- Ensured proper permissions with non-root user
- Simplified environment variable handling

## Step 3: Clean Up Existing Containers

To ensure a clean slate, we stopped and removed existing containers:

```bash
# Remove existing containers
docker stop trading-backend backend-timescaledb-1 backend-postgres-1
docker rm trading-backend backend-timescaledb-1 backend-postgres-1
```

## Step 4: Rebuild and Start Services

We rebuilt the containers and started them:

```bash
# Navigate to backend directory
cd backend

# Down any existing services and remove volumes
docker-compose down -v

# Build services without using cache
docker-compose build --no-cache

# Start services in detached mode
docker-compose up -d
```

## Step 5: Verify Setup

To ensure everything was working correctly, we:

1. Checked the container status:

   ```bash
   docker ps
   ```

2. Verified health endpoint was responsive:

   ```bash
   curl http://localhost:3001/health
   ```

3. Examined logs for any errors:
   ```bash
   docker logs trading-backend
   ```

## Final Configuration

The final configuration provides:

1. **Clean separation of concerns** between services
2. **Production-ready Dockerfile** following best practices
3. **Reliable database connections** through proper networking
4. **Proper health monitoring** for system reliability
5. **Simplified maintenance** through reduced complexity

## Lessons Learned

1. **Environment matters**: Ensure your Docker setup matches your deployment environment
2. **Keep it simple**: Remove unnecessary scripts and complexity
3. **Network configuration**: Explicitly define networks for container communication
4. **Health checks**: Implement proper health checks for all services
5. **Multi-stage builds**: Use multi-stage builds for optimized production images
6. **Security**: Run containers as non-root users when possible

## Next Steps

- **Production Deployment**: Configure for production with secure environment variables
- **Scaling**: Implement container orchestration for horizontal scaling
- **Monitoring**: Add monitoring and alerting for container health
- **Backup Strategy**: Implement regular database backups
