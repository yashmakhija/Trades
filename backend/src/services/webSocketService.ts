/**
 * WebSocket Service
 *
 * Manages WebSocket connections with clients, handling:
 * - Client connection management
 * - Symbol subscription system
 * - Real-time data broadcasting
 * - User authentication for private channels
 * - Order and balance updates broadcasting
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

let wss: WebSocket.Server | null = null;

interface ClientInfo {
  ws: WebSocket;
  subscribedSymbols: Set<string>;
  userId?: string;
}

const clients = new Map<WebSocket, ClientInfo>();

export function initWebSocketServer(server: Server): void {
  wss = new WebSocket.Server({ server });

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
