import winston from "winston";
import path from "path";
import { FixMessage } from "../../../types/fix/config";

const fixLogDir = path.join(process.cwd(), "logs", "fix");

const fixLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(fixLogDir, "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(fixLogDir, "combined.log"),
    }),
    new winston.transports.File({
      filename: path.join(fixLogDir, "messages.log"),
      level: "debug",
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  fixLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export class FixLogger {
  public logInfo(message: string): void {
    console.info(`info: ${message} ${this.formatTimestamp()}`);
  }

  public logError(message: string, error: Error): void {
    console.error(`error: ${message}`, {
      error: error.message,
      stack: error.stack,
      ...this.formatTimestamp(),
    });
  }

  public logConnection(
    service: "PRICING" | "TRADING" | "all",
    state: "connected" | "disconnected" | "reconnecting" | "ready"
  ): void {
    console.info(`${service} Connection ${state} ${this.formatTimestamp()}`);
  }

  public logMessage(
    service: "PRICING" | "TRADING",
    direction: "incoming" | "outgoing",
    message: FixMessage
  ): void {
    console.info(`${service} ${direction} message:`, {
      message,
      ...this.formatTimestamp(),
    });
  }

  private formatTimestamp(): { timestamp: string } {
    return { timestamp: new Date().toISOString() };
  }

  static logSession(event: string, details?: Record<string, any>): void {
    fixLogger.info(`Session Event: ${event}`, details);
  }

  static logHeartbeat(service: "pricing" | "trading", latency: number): void {
    fixLogger.debug(
      `${service.toUpperCase()} Heartbeat - Latency: ${latency}ms`
    );
  }

  static logOrder(
    event: string,
    orderId: string,
    details?: Record<string, any>
  ): void {
    fixLogger.info(`Order Event: ${event} - OrderID: ${orderId}`, details);
  }

  static logMarketData(symbol: string, details?: Record<string, any>): void {
    fixLogger.debug(`Market Data Update - Symbol: ${symbol}`, details);
  }
}
