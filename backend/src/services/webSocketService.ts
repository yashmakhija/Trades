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
import WebSocket, { WebSocketServer } from "ws";
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
import { balanceManager } from "./balanceManager";
import jwt from "jsonwebtoken";

// WebSocket client with authentication and connection state
interface WSClient {
  ws: WebSocket;
  userId?: string;
  isAlive: boolean;
  subscribedSymbols: Set<string>;
}

// Global state
let wss: WebSocketServer | null = null;
const clients = new Map<WebSocket, WSClient>();

async function verifyToken(token: string): Promise<string | null> {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    return user?.id || null;
  } catch (error) {
    return null;
  }
}

export function initWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server });
  candleService.setWebSocketServer(wss);

  wss.on("connection", async (ws: WebSocket, request) => {
    // Initialize client state
    const client: WSClient = {
      ws,
      isAlive: true,
      subscribedSymbols: new Set(),
    };
    clients.set(ws, client);

    try {
      // Authenticate client
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(1008, "Authentication required");
        return;
      }

      const userId = await verifyToken(token);
      if (!userId) {
        ws.close(1008, "Invalid authentication");
        return;
      }

      client.userId = userId;
      console.log(`Client authenticated with userId: ${userId}`);

      // Send initial data
      const balance = await balanceManager.getUserBalance(userId);
      if (balance) {
        ws.send(JSON.stringify({ type: "BALANCE_UPDATE", data: balance }));
      }

      // Send initial market data
      const allTickerData = getAllTickerData();
      ws.send(JSON.stringify({ type: "INITIAL_DATA", data: allTickerData }));

      // Send open orders
      const openOrders = await orderManager.getUserOpenOrders(userId);
      if (openOrders.length > 0) {
        ws.send(JSON.stringify({ type: "OPEN_ORDERS", data: openOrders }));
      }

      // Setup event handlers
      ws.on("pong", () => {
        const client = clients.get(ws);
        if (client) client.isAlive = true;
      });

      ws.on("message", async (message) => {
        try {
          await handleClientMessage(ws, message);
        } catch (error) {
          console.error("Error processing message:", error);
        }
      });

      ws.on("close", () => {
        console.log(`Client disconnected: ${client.userId}`);
        // Cleanup symbol tracking
        client.subscribedSymbols.forEach((symbol) => {
          let stillInUse = false;
          clients.forEach((otherClient) => {
            if (
              otherClient !== client &&
              otherClient.subscribedSymbols.has(symbol)
            ) {
              stillInUse = true;
            }
          });
          if (!stillInUse) {
            removeSymbolFromTracking(symbol);
          }
        });
        clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  // Health check interval
  const pingInterval = setInterval(() => {
    if (!wss) return;

    clients.forEach((client, ws) => {
      if (!client.isAlive) {
        console.log(
          `Terminating inactive connection for user: ${client.userId}`
        );
        clients.delete(ws);
        return ws.terminate();
      }
      client.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  console.log("WebSocket server initialized");
}

// Broadcast helpers
export function broadcastToUser(userId: string, type: string, data: any): void {
  if (!wss) {
    console.warn("WebSocket server not initialized");
    return;
  }

  const message = JSON.stringify({ type, data });

  clients.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

export function broadcastBalanceUpdate(userId: string, balanceData: any): void {
  broadcastToUser(userId, "BALANCE_UPDATE", balanceData);
}

export function broadcastTradeAnalytics(userId: string, analytics: any): void {
  broadcastToUser(userId, "TRADE_ANALYTICS_UPDATE", analytics);
}

export function broadcastOrderUpdate(userId: string, orderData: any): void {
  broadcastToUser(userId, "ORDER_UPDATE", orderData);
  // Also update balance since order status change affects it
  if (orderData.status === "FILLED" || orderData.status === "CANCELED") {
    balanceManager.getUserBalance(userId).then((balance) => {
      if (balance) broadcastBalanceUpdate(userId, balance);
    });
  }
}

// Broadcast market data to subscribed clients
export function broadcastTickerUpdate(symbol: string, data: any): void {
  if (!wss) return;

  const message = JSON.stringify({
    type: "TICKER_UPDATE",
    symbol,
    data,
  });

  clients.forEach((client) => {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      (client.subscribedSymbols.size === 0 ||
        client.subscribedSymbols.has(symbol))
    ) {
      client.ws.send(message);

      // Update balance manager with new price if client has positions
      if (client.userId) {
        balanceManager.updateSymbolPrice(symbol, data.price);
      }
    }
  });
}

// Handle client messages
async function handleClientMessage(
  ws: WebSocket,
  message: WebSocket.Data
): Promise<void> {
  const client = clients.get(ws);
  if (!client) return;

  try {
    const data = JSON.parse(message.toString());
    const symbol = (data.symbol || "").toLowerCase();

    switch (data.type) {
      case "SUBSCRIBE":
        if (symbol) {
          client.subscribedSymbols.add(symbol);
          addSymbolToTracking(symbol);
          console.log(`Client subscribed to ${symbol}`);

          const tickerData = getLatestTickerData(symbol);
          if (tickerData) {
            ws.send(
              JSON.stringify({
                type: "TICKER_UPDATE",
                symbol,
                data: tickerData,
              })
            );

            // Update balance manager with current price if client has positions
            if (client.userId) {
              balanceManager.updateSymbolPrice(symbol, tickerData.price);
            }
          }
        }
        break;

      case "UNSUBSCRIBE":
        if (symbol) {
          client.subscribedSymbols.delete(symbol);
          // Check if any other client is still subscribed
          let stillInUse = false;
          clients.forEach((otherClient) => {
            if (
              otherClient !== client &&
              otherClient.subscribedSymbols.has(symbol)
            ) {
              stillInUse = true;
            }
          });
          if (!stillInUse) {
            removeSymbolFromTracking(symbol);
          }
          console.log(`Client unsubscribed from ${symbol}`);
        }
        break;

      case "SUBSCRIBE_CANDLES":
        if (symbol) {
          const timeframe = data.timeframe || "1m";
          await handleCandleSubscription(client, symbol, timeframe);
        }
        break;

      case "PLACE_ORDER":
        if (client.userId && data.orderData) {
          try {
            const order = await orderManager.addOrder({
              userId: client.userId,
              ...data.orderData,
            });
            broadcastOrderUpdate(client.userId, order);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "ORDER_ERROR",
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to place order",
              })
            );
          }
        }
        break;

      case "CANCEL_ORDER":
        if (client.userId && data.orderId) {
          try {
            const order = await orderManager.cancelOrder(
              client.userId,
              data.orderId
            );
            broadcastOrderUpdate(client.userId, order);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "ORDER_ERROR",
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to cancel order",
              })
            );
          }
        }
        break;

      default:
        console.warn(`Unknown message type: ${data.type}`);
    }
  } catch (error) {
    console.error("Error handling client message:", error);
  }
}

async function handleCandleSubscription(
  client: WSClient,
  symbol: string,
  timeframe: string
): Promise<void> {
  try {
    const timeframeEnum = mapTimeframeToEnum(timeframe);
    client.subscribedSymbols.add(symbol);
    addSymbolToTracking(symbol);

    console.log(
      `Client subscribed to ${symbol} candles with timeframe ${timeframe}`
    );

    const candles = await candleService.getCandles(symbol, timeframeEnum);
    if (candles?.length) {
      client.ws.send(
        JSON.stringify({
          type: "CANDLE_HISTORY",
          symbol,
          timeframe,
          data: candles,
        })
      );

      // Update balance manager with latest candle price if client has positions
      if (client.userId) {
        const latestCandle = candles[candles.length - 1];
        balanceManager.updateSymbolPrice(symbol, latestCandle.close);
      }
    }
  } catch (error) {
    console.error(`Error subscribing to candles for ${symbol}:`, error);
  }
}

function mapTimeframeToEnum(timeframe: string): Timeframe {
  switch (timeframe) {
    case "1m":
      return Timeframe.ONE_MINUTE;
    case "5m":
      return Timeframe.FIVE_MINUTES;
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
