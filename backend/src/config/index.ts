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
};

try {
  configSchema.parse(config);
} catch (error) {
  console.error("Invalid configuration:", error);
  process.exit(1);
}
