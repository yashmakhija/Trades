import WebSocket from "ws";
import { config } from "../config";
import { prisma } from "../index";
import {
  BinanceSubscriptionMessage,
  BinanceTickerMessage,
  ProcessedTickerData,
} from "../types/binance";

const tickerCache: Record<string, ProcessedTickerData> = {};

let ws: WebSocket | null = null;

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
    await prisma.symbol.upsert({
      where: { name: data.symbol },
      update: {
        currentPrice: data.price,
        updatedAt: new Date(),
      },
      create: {
        name: data.symbol,
        currentPrice: data.price,
        description: `${data.symbol.toUpperCase()} trading pair`,
      },
    });

    console.log(`Updated price for ${data.symbol}: ${data.price / 100}`);
  } catch (error) {
    console.error(`Error updating symbol ${data.symbol}:`, error);
  }
}

function handleWebSocketMessage(message: WebSocket.Data): void {
  try {
    const data = JSON.parse(message.toString());

    if (data.e === "ticker") {
      const tickerData = processTickerData(data as BinanceTickerMessage);

      tickerCache[tickerData.symbol] = tickerData;

      if (tickerData.timestamp % 5000 < 1000) {
        updateSymbolPrice(tickerData);
      }
    }
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
  }
}

function subscribeToTickers(ws: WebSocket): void {
  const symbols = config.tradingSymbols.split(",");

  const subscriptionMsg: BinanceSubscriptionMessage = {
    method: "SUBSCRIBE",
    params: symbols.map((symbol) => `${symbol}@ticker`),
    id: 1,
  };

  ws.send(JSON.stringify(subscriptionMsg));
  console.log(`Subscribed to tickers: ${symbols.join(", ")}`);
}

export function startBinanceWebSocket(): void {
  if (ws) {
    ws.terminate();
  }

  ws = new WebSocket(config.binanceWebSocketUrl);

  ws.on("open", () => {
    console.log("Connected to Binance WebSocket");
    subscribeToTickers(ws!);
  });

  ws.on("message", handleWebSocketMessage);

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log(
      "Disconnected from Binance WebSocket, reconnecting in 5 seconds..."
    );
    setTimeout(startBinanceWebSocket, 5000);
  });
}

export function getLatestTickerData(
  symbol: string
): ProcessedTickerData | null {
  return tickerCache[symbol.toLowerCase()] || null;
}

export function getAllTickerData(): Record<string, ProcessedTickerData> {
  return { ...tickerCache };
}
