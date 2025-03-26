import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  databaseUrl: z.string(),
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  binanceWebSocketUrl: z.string().default("wss://stream.binance.com:9443/ws"),
  tradingSymbols: z.string().default("btcusdt,ethusdt,bnbusdt,solusdt,adausdt"),
  jwtSecret: z.string().default("trading-app-secret-key"),
  jwtExpiresIn: z.string().default("7d"),
  redis: z.object({
    host: z.string().default("localhost"),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),
});

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  binanceApiKey: process.env.BINANCE_API_KEY,
  binanceApiSecret: process.env.BINANCE_API_SECRET,
  binanceWebSocketUrl:
    process.env.BINANCE_WEBSOCKET_URL || "wss://stream.binance.com:9443/ws",
  tradingSymbols:
    process.env.TRADING_SYMBOLS || "btcusdt,ethusdt,bnbusdt,solusdt,adausdt",
  jwtSecret: process.env.JWT_SECRET || "trading-app-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
  },
};

try {
  configSchema.parse(config);
} catch (error) {
  console.error("Invalid configuration:", error);
  process.exit(1);
}
