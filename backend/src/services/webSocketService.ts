/**
 * WebSocket Service
 *
 * Manages WebSocket connections with clients, handling:
 * - Client connection management
 * - Symbol subscription system
 * - Real-time data broadcasting
 * - User authentication for private channels
 * - Order and balance updates broadcasting
 * - Candle data updates
 */
import { Server } from "http";
import WebSocket from "ws";
import {
  getAllTickerData,
  getLatestTickerData,
  addSymbolToTracking,
  removeSymbolFromTracking,
} from "./binanceService";
import { prisma } from "../server";
import { orderManager } from "./orderManager";
import { candleService } from "./candleService";
import { Timeframe } from "@prisma/client";

let wss: WebSocket.Server | null = null;

interface ClientInfo {
  ws: WebSocket;
  subscribedSymbols: Set<string>;
  userId?: string;
}

const clients = new Map<WebSocket, ClientInfo>();

export function initWebSocketServer(server: Server): void {
  wss = new WebSocket.Server({ server });

  // Set the WebSocket server in the candle service
  candleService.setWebSocketServer(wss);

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected to WebSocket");

    clients.set(ws, {
      ws,
      subscribedSymbols: new Set<string>(),
    });

    sendInitialData(ws);

    ws.on("message", (message: WebSocket.Data) => {
      handleClientMessage(ws, message);
    });

    ws.on("close", () => {
      console.log("Client disconnected from WebSocket");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
      clients.delete(ws);
    });

    setupPingPong(ws);
  });

  console.log("WebSocket server initialized");
}

function sendInitialData(ws: WebSocket): void {
  try {
    const allData = getAllTickerData();
    ws.send(
      JSON.stringify({
        type: "INITIAL_DATA",
        data: allData,
      })
    );
  } catch (error) {
    console.error("Error sending initial data:", error);
  }
}

async function handleClientMessage(
  ws: WebSocket,
  message: WebSocket.Data
): Promise<void> {
  try {
    let data;
    const messageStr = message.toString();

    try {
      data = JSON.parse(messageStr);
    } catch (parseError) {
      console.log(`Received plain text message: ${messageStr}`);
      data = {
        type: "SUBSCRIBE",
        symbol: messageStr.trim().toLowerCase(),
      };
    }

    const clientInfo = clients.get(ws);

    if (!clientInfo) {
      console.error("Client not found in clients map");
      return;
    }

    if (data.type === "SUBSCRIBE" && data.symbol) {
      const symbol = data.symbol.toLowerCase();

      clientInfo.subscribedSymbols.add(symbol);

      addSymbolToTracking(symbol);

      console.log(`Client subscribed to ${symbol}`);

      const tickerData = getLatestTickerData(symbol);
      if (tickerData) {
        ws.send(
          JSON.stringify({
            type: "TICKER_UPDATE",
            symbol,
            data: {
              ...tickerData,
              displayPrice: tickerData.price / 100,
            },
          })
        );
      }

      ws.send(
        JSON.stringify({
          type: "SUBSCRIPTION_SUCCESS",
          symbol,
          message: `Successfully subscribed to ${symbol.toUpperCase()}`,
        })
      );
    } else if (data.type === "UNSUBSCRIBE" && data.symbol) {
      const symbol = data.symbol.toLowerCase();

      clientInfo.subscribedSymbols.delete(symbol);

      let stillSubscribed = false;
      clients.forEach((info) => {
        if (info.subscribedSymbols.has(symbol)) {
          stillSubscribed = true;
        }
      });

      if (!stillSubscribed) {
        removeSymbolFromTracking(symbol);
      }

      console.log(`Client unsubscribed from ${symbol}`);

      ws.send(
        JSON.stringify({
          type: "UNSUBSCRIPTION_SUCCESS",
          symbol,
          message: `Successfully unsubscribed from ${symbol.toUpperCase()}`,
        })
      );
    } else if (data.type === "AUTHENTICATE" && data.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
        });

        if (user) {
          clientInfo.userId = user.id;
          console.log(`Client authenticated as user ${user.id}`);

          ws.send(
            JSON.stringify({
              type: "AUTHENTICATION_SUCCESS",
              userId: user.id,
              message: "Successfully authenticated",
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "AUTHENTICATION_ERROR",
              message: "User not found",
            })
          );
        }
      } catch (error) {
        console.error("Error authenticating client:", error);
        ws.send(
          JSON.stringify({
            type: "AUTHENTICATION_ERROR",
            message: "Authentication failed",
          })
        );
      }
    } else if (data.type === "SUBSCRIBE_CANDLES" && data.symbol) {
      const symbol = data.symbol.toLowerCase();
      const timeframe = data.timeframe || "1m";

      // Map string timeframe to Prisma Timeframe enum
      const timeframeEnum = mapTimeframeToEnum(timeframe);

      clientInfo.subscribedSymbols.add(symbol);
      addSymbolToTracking(symbol);

      console.log(
        `Client subscribed to ${symbol} candles with timeframe ${timeframe}`
      );

      try {
        // Get the latest candles for this symbol and timeframe
        const candles = await candleService.getCandles(symbol, timeframeEnum);

        if (candles && candles.length > 0) {
          ws.send(
            JSON.stringify({
              type: "CANDLE_HISTORY",
              symbol,
              timeframe,
              data: candles.map((c) => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume,
              })),
            })
          );
        }

        ws.send(
          JSON.stringify({
            type: "SUBSCRIPTION_SUCCESS",
            symbol,
            channel: "candles",
            timeframe,
            message: `Successfully subscribed to ${symbol.toUpperCase()} candles with timeframe ${timeframe}`,
          })
        );
      } catch (error) {
        console.error(`Error fetching candles for ${symbol}:`, error);
        ws.send(
          JSON.stringify({
            type: "SUBSCRIPTION_ERROR",
            symbol,
            channel: "candles",
            timeframe,
            message: `Error subscribing to ${symbol.toUpperCase()} candles: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          })
        );
      }
    } else if (data.type === "UNSUBSCRIBE_CANDLES" && data.symbol) {
      const symbol = data.symbol.toLowerCase();
      const timeframe = data.timeframe || "1m";

      console.log(
        `Client unsubscribed from ${symbol} candles with timeframe ${timeframe}`
      );

      ws.send(
        JSON.stringify({
          type: "UNSUBSCRIPTION_SUCCESS",
          symbol,
          channel: "candles",
          timeframe,
          message: `Successfully unsubscribed from ${symbol.toUpperCase()} candles with timeframe ${timeframe}`,
        })
      );
    }
  } catch (error) {
    console.error("Error handling client message:", error);
  }
}

function setupPingPong(ws: WebSocket): void {
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on("pong", () => {});

  ws.on("close", () => {
    clearInterval(pingInterval);
  });
}

export function broadcastTickerUpdate(symbol: string, data: any): void {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: "TICKER_UPDATE",
    symbol,
    data,
  });

  clients.forEach((clientInfo) => {
    const { ws, subscribedSymbols } = clientInfo;

    if (
      ws.readyState === WebSocket.OPEN &&
      (subscribedSymbols.size === 0 || subscribedSymbols.has(symbol))
    ) {
      ws.send(message);
    }
  });
}

export function broadcastOHLCVUpdate(symbol: string, data: any): void {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: "OHLCV_UPDATE",
    symbol,
    data,
  });

  // Send to all clients or only to those subscribed to this symbol
  clients.forEach((clientInfo) => {
    const { ws, subscribedSymbols } = clientInfo;

    // Send if client is subscribed to this symbol or has no specific subscriptions
    if (
      ws.readyState === WebSocket.OPEN &&
      (subscribedSymbols.size === 0 || subscribedSymbols.has(symbol))
    ) {
      ws.send(message);
    }
  });
}

/**
 * Broadcast raw data from Binance directly to clients
 */
export function broadcastRawData(symbol: string, data: any): void {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: "RAW_DATA",
    symbol,
    data,
  });

  // Send to clients subscribed to this symbol
  clients.forEach((clientInfo) => {
    const { ws, subscribedSymbols } = clientInfo;

    // Only send to clients specifically subscribed to this symbol
    if (ws.readyState === WebSocket.OPEN && subscribedSymbols.has(symbol)) {
      ws.send(message);
    }
  });
}

/**
 * Broadcast order updates to the specific user
 */
export function broadcastOrderUpdate(userId: string, orderData: any): void {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: "ORDER_UPDATE",
    data: orderData,
  });

  // Send only to clients authenticated as this user
  clients.forEach((clientInfo) => {
    const { ws, userId: clientUserId } = clientInfo;

    if (ws.readyState === WebSocket.OPEN && clientUserId === userId) {
      ws.send(message);
    }
  });
}

/**
 * Broadcast balance updates to the specific user
 */
export function broadcastBalanceUpdate(userId: string, balanceData: any): void {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: "BALANCE_UPDATE",
    data: balanceData,
  });

  // Send only to clients authenticated as this user
  clients.forEach((clientInfo) => {
    const { ws, userId: clientUserId } = clientInfo;

    if (ws.readyState === WebSocket.OPEN && clientUserId === userId) {
      ws.send(message);
    }
  });
}

export function getConnectedClientsCount(): number {
  return clients.size;
}

export function getAuthenticatedClientsCount(): number {
  let count = 0;
  clients.forEach((clientInfo) => {
    if (clientInfo.userId) {
      count++;
    }
  });
  return count;
}

/**
 * Map string timeframe to Prisma Timeframe enum
 */
function mapTimeframeToEnum(timeframe: string): Timeframe {
  switch (timeframe) {
    case "1m":
      return Timeframe.ONE_MINUTE;
    case "5m":
      return Timeframe.FIVE_MINUTES;
    case "10m":
      return Timeframe.TEN_MINUTES;
    case "15m":
      return Timeframe.FIFTEEN_MINUTES;
    case "30m":
      return Timeframe.THIRTY_MINUTES;
    case "1h":
      return Timeframe.ONE_HOUR;
    case "4h":
      return Timeframe.FOUR_HOURS;
    case "1d":
      return Timeframe.ONE_DAY;
    default:
      return Timeframe.ONE_MINUTE;
  }
}

/**
 * Map Prisma Timeframe enum to string
 */
function mapEnumToTimeframe(timeframe: Timeframe): string {
  switch (timeframe) {
    case Timeframe.ONE_MINUTE:
      return "1m";
    case Timeframe.FIVE_MINUTES:
      return "5m";
    case Timeframe.TEN_MINUTES:
      return "10m";
    case Timeframe.FIFTEEN_MINUTES:
      return "15m";
    case Timeframe.THIRTY_MINUTES:
      return "30m";
    case Timeframe.ONE_HOUR:
      return "1h";
    case Timeframe.FOUR_HOURS:
      return "4h";
    case Timeframe.ONE_DAY:
      return "1d";
    default:
      return "1m";
  }
}
