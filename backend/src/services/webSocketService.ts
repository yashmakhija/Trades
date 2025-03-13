import { Server } from "http";
import WebSocket from "ws";
import {
  getAllTickerData,
  getLatestTickerData,
  addSymbolToTracking,
  removeSymbolFromTracking,
} from "./binanceService";

let wss: WebSocket.Server | null = null;

// Store clients with their subscribed symbols
interface ClientInfo {
  ws: WebSocket;
  subscribedSymbols: Set<string>;
}

const clients = new Map<WebSocket, ClientInfo>();

export function initWebSocketServer(server: Server): void {
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected to WebSocket");

    // Initialize client info
    clients.set(ws, {
      ws,
      subscribedSymbols: new Set<string>(),
    });

    // Send initial data to the client
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

function handleClientMessage(ws: WebSocket, message: WebSocket.Data): void {
  try {
    let data;
    const messageStr = message.toString();

    // Try to parse as JSON, but handle plain text if it fails
    try {
      data = JSON.parse(messageStr);
    } catch (parseError) {
      // If it's not valid JSON, treat it as a symbol name for subscription
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

      // Add symbol to client's subscriptions
      clientInfo.subscribedSymbols.add(symbol);

      // Add to active tracking in Binance service
      addSymbolToTracking(symbol);

      console.log(`Client subscribed to ${symbol}`);

      // Send the latest data for this symbol
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

      // Send confirmation
      ws.send(
        JSON.stringify({
          type: "SUBSCRIPTION_SUCCESS",
          symbol,
          message: `Successfully subscribed to ${symbol.toUpperCase()}`,
        })
      );
    } else if (data.type === "UNSUBSCRIBE" && data.symbol) {
      const symbol = data.symbol.toLowerCase();

      // Remove symbol from client's subscriptions
      clientInfo.subscribedSymbols.delete(symbol);

      // Check if any other clients are still subscribed to this symbol
      let stillSubscribed = false;
      clients.forEach((info) => {
        if (info.subscribedSymbols.has(symbol)) {
          stillSubscribed = true;
        }
      });

      // If no clients are subscribed, remove from active tracking
      if (!stillSubscribed) {
        removeSymbolFromTracking(symbol);
      }

      console.log(`Client unsubscribed from ${symbol}`);

      // Send confirmation
      ws.send(
        JSON.stringify({
          type: "UNSUBSCRIPTION_SUCCESS",
          symbol,
          message: `Successfully unsubscribed from ${symbol.toUpperCase()}`,
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

export function getConnectedClientsCount(): number {
  return clients.size;
}

export function getSubscribedSymbolsCount(): Record<string, number> {
  const counts: Record<string, number> = {};

  clients.forEach((clientInfo) => {
    clientInfo.subscribedSymbols.forEach((symbol) => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });
  });

  return counts;
}
