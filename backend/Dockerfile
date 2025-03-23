# Stage 1: Build stage
FROM oven/bun:1.0.30 AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bunx prisma generate

# Stage 2: Production stage
FROM oven/bun:1.0.30 AS production
WORKDIR /app

# Install PostgreSQL client for database operations
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./

RUN chown -R bun:bun /app
RUN chmod +x /app/scripts/run-migrations.sh
RUN chmod +x /app/scripts/db-init.sh

ENV PORT=3001 \
    NODE_ENV=production 

# Create healthcheck script
RUN echo '#!/bin/sh\ncurl -f http://localhost:${PORT:-3001}/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Create entrypoint script with better data protection
RUN echo '#!/bin/sh\n\
if [ -z "$SKIP_DB_SETUP" ]; then\n\
  echo "Running database setup..."\n\
  # Check if database has tables already\n\
  tables_exist=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = '\''public'\''" 2>/dev/null || echo "0")\n\
  \n\
  if [ "$tables_exist" = "0" ]; then\n\
    echo "No tables found. Running initial schema setup..."\n\
    /app/scripts/run-migrations.sh\n\
  else\n\
    echo "Database tables already exist. Skipping initial schema push."\n\
    if [ -n "$SEED_DATABASE" ] && [ "$SEED_DATABASE" = "true" ]; then\n\
      echo "Applying seed data if needed..."\n\
      bash /app/scripts/db-init.sh\n\
    fi\n\
  fi\n\
else\n\
  echo "Skipping database setup as SKIP_DB_SETUP is set"\n\
fi\n\
\n\
echo "Starting application..."\n\
exec bun src/index.ts\n\
' > /app/entrypoint.sh && \
chmod +x /app/entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["/app/healthcheck.sh"]

USER bun

CMD ["/app/entrypoint.sh"] 