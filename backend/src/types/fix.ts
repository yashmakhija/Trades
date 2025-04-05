import { Socket } from "net";
import { EventEmitter } from "events";

export interface FixCredentials {
  username: string;
  password: string;
}

export interface FixSession {
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
}

export interface FixConnectionConfig {
  host: string;
  port: number;
  fixVersion: string;
  dictionary: any;
  senderCompID: string;
  targetCompID: string;
  heartbeat: number;
  credentials: {
    username: string;
    password: string;
  };
  ssl: boolean;
  resetOnLogon: boolean;
  session: FixSession;
}

export interface FixReconnectConfig {
  maxAttempts: number;
  interval: number;
}

export interface FixLoggingConfig {
  level: string;
  file: string;
}

export interface FixConfig {
  marketData: FixConnectionConfig;
  trading: FixConnectionConfig;
  reconnect: FixReconnectConfig;
  logging: FixLoggingConfig;
}

export interface FixMessage {
  type: string;
  content: Record<string, any>;
  direction: "incoming" | "outgoing";
  timestamp: Date;
}

export interface FixOrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: "DAY" | "GTC" | "IOC" | "FOK";
  status: "NEW" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED" | "REJECTED";
  clientOrderId: string;
  timestamp: Date;
}

export interface FixPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: Date;
}

export interface FixMarketData {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  lastPrice: number;
  volume: number;
  timestamp: Date;
}

export interface FixError extends Error {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  fixMessage?: FixMessage;
}

export interface FixClient {
  socket: Socket;
  createConnection(
    callback: (error: Error | null, client: FixClient) => void
  ): void;
  destroyConnection(): void;
  sendMsg(message: FixMessage, callback: (response: any) => void): void;
  sendLogon(additionalTags?: Record<string, any>): void;
  sendLogoff(additionalTags?: Record<string, any>): void;
  modifyBehavior(data: Record<string, any>): void;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  removeListener(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
  emit(event: string, ...args: any[]): boolean;
}
