# Stage 1: Build stage
FROM oven/bun:1.0.30 AS builder
WORKDIR /app


RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs


COPY package.json bun.lock ./
RUN bun install


COPY . .
RUN npx prisma generate


FROM oven/bun:1.0.30 AS production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./

RUN chown -R bun:bun /app

ENV PORT=3001 \
    NODE_ENV=production 

RUN echo '#!/bin/sh\ncurl -f http://localhost:${PORT:-3001}/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["/app/healthcheck.sh"]

USER bun

CMD ["bun", "src/index.ts"] 