import { useEffect } from "react";
import { useWebSocketStore } from "./websocket";
import { useMarketDataStore } from "@/store/use-market-data-store";
import { DEFAULT_SYMBOLS } from "@/config";

/**
 * Custom hook that synchronizes WebSocket data with the MarketDataStore
 * This keeps the market data store updated with the latest prices for all symbols
 */
export function useWebSocketMarketSync() {
  const { tickerData, connectionState, subscribeToSymbol } =
    useWebSocketStore();
  const { updateSymbol } = useMarketDataStore();

  // Subscribe to default symbols on connection
  useEffect(() => {
    if (connectionState === "connected") {
      // Subscribe to all default symbols to ensure we have data for the sidebar
      DEFAULT_SYMBOLS.forEach((symbol) => {
        subscribeToSymbol(symbol);
      });
    }
  }, [connectionState, subscribeToSymbol]);

  // Sync ticker data to market data store
  useEffect(() => {
    Object.entries(tickerData).forEach(([symbol, data]) => {
      if (data) {
        updateSymbol({
          name: symbol,
          price: data.price,
          priceChangePercent: data.priceChangePercent,
          volume: data.volume,
          high: data.high || null,
          low: data.low || null,
        });
      }
    });
  }, [tickerData, updateSymbol]);

  // Return connection state for convenience
  return {
    isConnected: connectionState === "connected",
  };
}
