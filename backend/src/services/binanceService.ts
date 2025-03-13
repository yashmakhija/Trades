import WebSocket from "ws";
import { config } from "../config";
import { prisma } from "../index";
import {
  BinanceSubscriptionMessage,
  BinanceTickerMessage,
  BinanceKlineMessage,
  ProcessedTickerData,
} from "../types/binance";
import {
  broadcastTickerUpdate,
  broadcastOHLCVUpdate,
  broadcastRawData,
} from "./webSocketService";
import axios from "axios";

const tickerCache: Record<string, ProcessedTickerData> = {};

const symbolCache: Record<string, { id: string; name: string }> = {};

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

let heartbeatInterval: NodeJS.Timeout | null = null;

const activeSymbols = new Set<string>();

async function initializeSymbols(): Promise<void> {
  try {
    const symbols = config.tradingSymbols.split(",");
    console.log(`Initializing symbols: ${symbols.join(", ")}`);

    for (const symbolName of symbols) {
      activeSymbols.add(symbolName.toLowerCase());

      const symbol = await prisma.symbol.upsert({
        where: { name: symbolName.toLowerCase() },
        update: {},
        create: {
          name: symbolName.toLowerCase(),
          description: `${symbolName.toUpperCase()} trading pair`,
        },
      });

      symbolCache[symbolName.toLowerCase()] = {
        id: symbol.id,
        name: symbol.name,
      };

      console.log(`Initialized symbol: ${symbolName.toLowerCase()}`);
    }
  } catch (error) {
    console.error("Error initializing symbols:", error);
  }
}

async function getSymbol(
  symbolName: string
): Promise<{ id: string; name: string } | null> {
  const name = symbolName.toLowerCase();

  if (symbolCache[name]) {
    return symbolCache[name];
  }

  try {
    const symbol = await prisma.symbol.findUnique({
      where: { name },
      select: { id: true, name: true },
    });

    if (symbol) {
      symbolCache[name] = symbol;
      return symbol;
    }

    const newSymbol = await prisma.symbol.create({
      data: {
        name,
        description: `${symbolName.toUpperCase()} trading pair`,
      },
      select: { id: true, name: true },
    });

    symbolCache[name] = newSymbol;
    return newSymbol;
  } catch (error) {
    console.error(`Error getting symbol ${name}:`, error);
    return null;
  }
}

function processTickerData(data: BinanceTickerMessage): ProcessedTickerData {
  const price = Math.round(parseFloat(data.c) * 100);

  return {
    symbol: data.s.toLowerCase(),
    price,
    priceChangePercent: parseFloat(data.P),
    volume: parseFloat(data.v),
    timestamp: data.E,
  };
}

async function updateSymbolPrice(data: ProcessedTickerData): Promise<void> {
  try {
    const symbol = await getSymbol(data.symbol);

    if (!symbol) {
      console.error(`Failed to get or create symbol ${data.symbol}`);
      return;
    }

    await prisma.symbol.update({
      where: { id: symbol.id },
      data: {
        currentPrice: data.price,
        updatedAt: new Date(),
      },
    });

    console.log(`Updated price for ${data.symbol}: ${data.price / 100}`);

    broadcastTickerUpdate(data.symbol, {
      ...data,
      displayPrice: data.price / 100,
    });
  } catch (error) {
    console.error(`Error updating symbol ${data.symbol}:`, error);
  }
}

async function processKlineData(data: BinanceKlineMessage): Promise<void> {
  try {
    const kline = data.k;
    const symbolName = data.s.toLowerCase();

    const symbol = await getSymbol(symbolName);

    if (!symbol) {
      console.error(`Failed to get or create symbol ${symbolName}`);
      return;
    }

    const open = Math.round(parseFloat(kline.o) * 100);
    const high = Math.round(parseFloat(kline.h) * 100);
    const low = Math.round(parseFloat(kline.l) * 100);
    const close = Math.round(parseFloat(kline.c) * 100);
    const volume = Math.round(parseFloat(kline.v) * 100);

    if (kline.x) {
      const ohlcvData = await prisma.oHLCV.create({
        data: {
          symbolId: symbol.id,
          open,
          high,
          low,
          close,
          volume,
          timestamp: new Date(kline.T),
        },
      });

      console.log(
        `Stored OHLCV data for ${symbolName} at ${new Date(
          kline.T
        ).toISOString()}`
      );

      broadcastOHLCVUpdate(symbolName, {
        id: ohlcvData.id,
        symbol: symbolName,
        open: open / 100,
        high: high / 100,
        low: low / 100,
        close: close / 100,
        volume: volume / 100,
        timestamp: new Date(kline.T).toISOString(),
      });
    }
  } catch (error) {
    console.error("Error processing kline data:", error);
  }
}

function handleWebSocketMessage(message: WebSocket.Data): void {
  try {
    const data = JSON.parse(message.toString());

    resetHeartbeat();

    const symbolKey = data.s ? data.s.toLowerCase() : null;
    if (symbolKey && activeSymbols.has(symbolKey)) {
      broadcastRawData(symbolKey, data);
    }

    if (data.e === "ticker") {
      const tickerData = processTickerData(data as BinanceTickerMessage);

      tickerCache[tickerData.symbol] = tickerData;

      if (tickerData.timestamp % 5000 < 1000) {
        updateSymbolPrice(tickerData);
      }
    }

    if (data.e === "kline") {
      processKlineData(data as BinanceKlineMessage);
    }
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
}

function subscribeToStreams(ws: WebSocket): void {
  const symbols = config.tradingSymbols.split(",");

  const tickerSubscriptionMsg: BinanceSubscriptionMessage = {
    method: "SUBSCRIBE",
    params: symbols.map((symbol) => `${symbol}@ticker`),
    id: 1,
  };

  // Create subscription message for klines (1m timeframe)
  const klineSubscriptionMsg: BinanceSubscriptionMessage = {
    method: "SUBSCRIBE",
    params: symbols.map((symbol) => `${symbol}@kline_1m`),
    id: 2,
  };

  // Send subscription messages
  ws.send(JSON.stringify(tickerSubscriptionMsg));
  console.log(`Subscribed to tickers: ${symbols.join(", ")}`);

  ws.send(JSON.stringify(klineSubscriptionMsg));
  console.log(`Subscribed to 1m klines: ${symbols.join(", ")}`);
}

/**
 * Setup heartbeat to detect stale connections
 */
function setupHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Using NodeJS.Timer instead of NodeJS.Timeout to fix the Symbol.dispose error
  heartbeatInterval = setInterval(() => {
    console.log("No message received for 30 seconds, reconnecting...");
    reconnectWebSocket();
  }, 30000) as unknown as NodeJS.Timeout; // 30 seconds
}

/**
 * Reset heartbeat timer
 */
function resetHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  setupHeartbeat();
}

/**
 * Reconnect WebSocket
 */
function reconnectWebSocket(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
    );
    return;
  }

  reconnectAttempts++;
  console.log(
    `Reconnecting to Binance WebSocket (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
  );

  // Close existing connection
  if (ws) {
    ws.terminate();
    ws = null;
  }

  // Clear heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Reconnect with exponential backoff
  setTimeout(() => {
    startBinanceWebSocket();
  }, RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1));
}

/**
 * Check Binance API status
 */
async function checkBinanceApiStatus(): Promise<boolean> {
  try {
    const response = await axios.get("https://api.binance.com/api/v3/ping");
    return response.status === 200;
  } catch (error) {
    console.error("Error checking Binance API status:", error);
    return false;
  }
}

/**
 * Start Binance WebSocket connection
 */
export async function startBinanceWebSocket(): Promise<void> {
  // Initialize symbols first
  await initializeSymbols();

  // Check if Binance API is available
  const isApiAvailable = await checkBinanceApiStatus();
  if (!isApiAvailable) {
    console.error("Binance API is not available. Will retry in 30 seconds.");
    setTimeout(startBinanceWebSocket, 30000);
    return;
  }

  // Close existing connection if any
  if (ws) {
    ws.terminate();
  }

  // Create new WebSocket connection
  ws = new WebSocket(config.binanceWebSocketUrl);

  // Set up event handlers
  ws.on("open", () => {
    console.log("Connected to Binance WebSocket");
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    subscribeToStreams(ws!);
    setupHeartbeat();
  });

  ws.on("message", handleWebSocketMessage);

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("Disconnected from Binance WebSocket");

    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Reconnect
    setTimeout(() => {
      reconnectWebSocket();
    }, RECONNECT_DELAY_MS);
  });

  // Set a connection timeout
  const connectionTimeout = setTimeout(() => {
    if (ws && ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket connection timeout");
      ws.terminate();
    }
  }, 10000); // 10 seconds timeout

  ws.on("open", () => {
    clearTimeout(connectionTimeout);
  });
}

/**
 * Get latest ticker data for a symbol
 */
export function getLatestTickerData(
  symbol: string
): ProcessedTickerData | null {
  return tickerCache[symbol.toLowerCase()] || null;
}

export function getAllTickerData(): Record<string, ProcessedTickerData> {
  return { ...tickerCache };
}

export function isWebSocketConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function addSymbolToTracking(symbol: string): boolean {
  const symbolName = symbol.toLowerCase();

  if (!config.tradingSymbols.toLowerCase().includes(symbolName)) {
    return false;
  }

  activeSymbols.add(symbolName);
  console.log(`Added ${symbolName} to active tracking`);
  return true;
}

export function removeSymbolFromTracking(symbol: string): boolean {
  const symbolName = symbol.toLowerCase();

  if (activeSymbols.has(symbolName)) {
    activeSymbols.delete(symbolName);
    console.log(`Removed ${symbolName} from active tracking`);
    return true;
  }

  return false;
}

export function getActiveSymbols(): string[] {
  return Array.from(activeSymbols);
}
