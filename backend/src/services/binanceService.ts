import WebSocket from "ws";
import { config } from "../config";
import { prisma } from "../lib/prisma";
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
import { orderManager } from "./orderManager";
import { Timeframe } from "@prisma/client";
import { redisService } from "./redisService";

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

/**
 * Map Binance timeframe to our Timeframe enum
 */
function mapBinanceTimeframeToEnum(timeframe: string): string {
  switch (timeframe) {
    case "1m":
      return "ONE_MINUTE";
    case "5m":
      return "FIVE_MINUTES";
    case "15m":
      return "FIFTEEN_MINUTES";
    case "30m":
      return "THIRTY_MINUTES";
    case "1h":
      return "ONE_HOUR";
    case "4h":
      return "FOUR_HOURS";
    case "1d":
      return "ONE_DAY";
    default:
      return "ONE_MINUTE";
  }
}

async function processKlineData(data: BinanceKlineMessage): Promise<void> {
  try {
    const kline = data.k;
    const symbolName = data.s.toLowerCase();

    // Extract the timeframe from the Binance kline data
    const binanceTimeframe = kline.i;
    const timeframe = mapBinanceTimeframeToEnum(binanceTimeframe);

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

    // Store the candle data
    const ohlcvData = await prisma.oHLCV.create({
      data: {
        symbolId: symbol.id,
        open,
        high,
        low,
        close,
        volume,
        time: new Date(kline.T),
        timeframe: timeframe as Timeframe,
      },
    });

    // Update Redis cache
    const candleData = {
      time: new Date(kline.T).getTime(),
      open,
      high,
      low,
      close,
      volume,
    };

    // Update latest candle in Redis
    await redisService.updateLatestCandle(
      symbolName,
      timeframe as Timeframe,
      candleData
    );

    // If this is a completed candle (kline.x is true), update the historical cache
    if (kline.x) {
      console.log(
        `Stored completed OHLCV data for ${symbolName} (${timeframe}) at ${new Date(
          kline.T
        ).toISOString()}`
      );

      // Broadcast the completed candle
      broadcastOHLCVUpdate(symbolName, timeframe, {
        id: ohlcvData.id,
        symbol: symbolName,
        open: open / 100,
        high: high / 100,
        low: low / 100,
        close: close / 100,
        volume: volume / 100,
        timestamp: new Date(kline.T).toISOString(),
      });

      // Fetch and update historical data in Redis
      const historicalCandles = await prisma.oHLCV.findMany({
        where: {
          symbolId: symbol.id,
          timeframe: timeframe as Timeframe,
          time: {
            lte: new Date(kline.T),
          },
        },
        orderBy: {
          time: "asc",
        },
        select: {
          time: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      const formattedCandles = historicalCandles.map((candle) => ({
        time: candle.time.getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));

      await redisService.cacheCandles(
        symbolName,
        timeframe as Timeframe,
        formattedCandles
      );
    } else {
      // For in-progress candles, just update the latest candle
      console.log(
        `Updated in-progress OHLCV data for ${symbolName} (${timeframe}) at ${new Date(
          kline.T
        ).toISOString()}`
      );
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

    // Process different message types that contain price information
    if (data.e === "ticker") {
      const tickerData = processTickerData(data as BinanceTickerMessage);

      tickerCache[tickerData.symbol] = tickerData;

      if (tickerData.timestamp % 5000 < 1000) {
        updateSymbolPrice(tickerData);
      }

      // Check for stop-loss and take-profit triggers
      console.log(
        `Checking price triggers for ${tickerData.symbol} at price ${
          tickerData.price / 100
        }`
      );
      orderManager.checkPriceTriggers(tickerData.symbol, tickerData.price);

      broadcastTickerUpdate(tickerData.symbol, {
        ...tickerData,
        displayPrice: tickerData.price / 100,
      });
    } else if (data.e === "24hrTicker") {
      // Handle 24hr ticker updates which also contain price information
      const symbol = data.s.toLowerCase();
      const price = Math.round(parseFloat(data.c) * 100);

      console.log(
        `Received 24hrTicker for ${symbol} with price ${price / 100}`
      );

      // Update the ticker cache
      if (!tickerCache[symbol]) {
        tickerCache[symbol] = {
          symbol,
          price,
          priceChangePercent: parseFloat(data.P),
          volume: parseFloat(data.v),
          timestamp: data.E,
        };
      } else {
        tickerCache[symbol].price = price;
        tickerCache[symbol].timestamp = data.E;
      }

      // Check for stop-loss and take-profit triggers
      console.log(
        `Checking price triggers for ${symbol} at price ${price / 100}`
      );
      orderManager.checkPriceTriggers(symbol, price);

      // Broadcast the ticker update
      broadcastTickerUpdate(symbol, {
        ...tickerCache[symbol],
        displayPrice: price / 100,
      });
    } else if (data.e === "trade") {
      // Handle individual trade updates
      const symbol = data.s.toLowerCase();
      const price = Math.round(parseFloat(data.p) * 100);

      console.log(`Received trade for ${symbol} with price ${price / 100}`);

      // Check for stop-loss and take-profit triggers on each trade
      console.log(
        `Checking price triggers for ${symbol} at price ${price / 100}`
      );
      orderManager.checkPriceTriggers(symbol, price);
    }

    if (data.e === "kline") {
      processKlineData(data as BinanceKlineMessage);

      // Also check price triggers based on candle close price
      const kline = data.k;
      const symbol = data.s.toLowerCase();
      const closePrice = Math.round(parseFloat(kline.c) * 100);

      console.log(
        `Received kline for ${symbol} with close price ${closePrice / 100}`
      );

      // Check for stop-loss and take-profit triggers
      console.log(
        `Checking price triggers for ${symbol} at price ${closePrice / 100}`
      );
      orderManager.checkPriceTriggers(symbol, closePrice);
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

  // Only subscribe to 1m klines from Binance - we'll derive other timeframes
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
  setTimeout(
    () => {
      startBinanceWebSocket();
    },
    RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1)
  );
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

  // Load existing open orders into memory
  await orderManager.loadExistingOrders();

  // Check if Binance API is available
  const isApiAvailable = await checkBinanceApiStatus();
  if (!isApiAvailable) {
    console.error("Binance API is not available. Using mock data.");
    // TODO: Implement mock data generation
    return;
  }

  // Close existing connection if any
  if (ws) {
    console.log("Closing existing Binance WebSocket connection");
    ws.terminate();
    ws = null;
  }

  try {
    console.log(
      `Connecting to Binance WebSocket at ${config.binanceWebSocketUrl}`
    );

    ws = new WebSocket(config.binanceWebSocketUrl);

    ws.on("open", () => {
      console.log("Connected to Binance WebSocket");
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      subscribeToStreams(ws!);
      setupHeartbeat();
    });

    ws.on("message", (message) => {
      try {
        handleWebSocketMessage(message);
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("Binance WebSocket error:", error);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(
        `Disconnected from Binance WebSocket. Code: ${code}, Reason: ${
          reason ? reason.toString() : "Unknown"
        }`
      );

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      setTimeout(() => {
        reconnectWebSocket();
      }, RECONNECT_DELAY_MS);
    });

    const connectionTimeout = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        console.error("Binance WebSocket connection timeout");
        ws.terminate();
        ws = null;
        reconnectWebSocket();
      }
    }, 10000); // 10 seconds timeout

    ws.on("open", () => {
      clearTimeout(connectionTimeout);
    });
  } catch (error) {
    console.error("Error creating Binance WebSocket connection:", error);
    setTimeout(() => {
      reconnectWebSocket();
    }, RECONNECT_DELAY_MS);
  }
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
