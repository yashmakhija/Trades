"use client";

import { useEffect, useState } from "react";
import { marketApi } from "@/lib/api/market-api";
import { useMarketStore } from "@/store/use-market-store";
import type { Symbol as MarketSymbol } from "@/store/use-market-store";
import { useWebSocketStore } from "@/services/websocket";

export function useMarket() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    symbols,
    selectedSymbol,
    priceUpdates,
    isConnected,
    setSymbols,
    setSelectedSymbol,
  } = useMarketStore();

  const { subscribeToSymbol, unsubscribeFromSymbol } = useWebSocketStore();

  // Fetch all available symbols
  const fetchSymbols = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const symbols = await marketApi.getSymbols();
      setSymbols(symbols);
      return symbols;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch symbols";
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch a specific symbol by name
  const fetchSymbol = async (name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const symbol = await marketApi.getSymbol(name);
      return symbol;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch symbol";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Select a symbol and subscribe to its updates
  const handleSelectSymbol = (symbol: MarketSymbol) => {
    // Unsubscribe from previously selected symbol if any
    if (selectedSymbol) {
      unsubscribeFromSymbol(selectedSymbol.id);
    }

    // Select the new symbol
    setSelectedSymbol(symbol);

    // Subscribe to the new symbol
    subscribeToSymbol(symbol.id);
  };

  // Get the latest price for a symbol
  const getLatestPrice = (symbolId: string) => {
    const updates = priceUpdates[symbolId];
    if (!updates || updates.length === 0) return null;

    // Return the most recent price update
    return updates[updates.length - 1];
  };

  // Get price history for a symbol
  const getPriceHistory = (symbolId: string) => {
    return priceUpdates[symbolId] || [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from selected symbol when component unmounts
      if (selectedSymbol) {
        unsubscribeFromSymbol(selectedSymbol.id);
      }
    };
  }, [selectedSymbol, unsubscribeFromSymbol]);

  return {
    symbols,
    selectedSymbol,
    isLoading,
    error,
    isConnected,
    fetchSymbols,
    fetchSymbol,
    selectSymbol: handleSelectSymbol,
    getLatestPrice,
    getPriceHistory,
  };
}
