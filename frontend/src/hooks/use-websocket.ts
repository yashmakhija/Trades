"use client";

import { useEffect, useState } from "react";
import { webSocketService } from "@/lib/websocket";
import { useMarketStore } from "@/store/use-market-store";

export function useWebSocket() {
  const isConnected = useMarketStore((state) => state.isConnected);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isInitialized) {
      webSocketService.connect();
      setIsInitialized(true);
    }

    // Cleanup on unmount
    return () => {
      // We don't disconnect here as we want to maintain the connection
      // across component unmounts. The service will be responsible for
      // reconnecting if needed.
    };
  }, [isInitialized]);

  // Subscribe to a symbol
  const subscribeToSymbol = (symbol: string) => {
    webSocketService.subscribe(symbol);
  };

  // Unsubscribe from a symbol
  const unsubscribeFromSymbol = (symbol: string) => {
    webSocketService.unsubscribe(symbol);
  };

  // Place an order via WebSocket
  const placeOrder = (order: {
    symbol: string;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    isShort: boolean;
    stopLoss?: number;
    takeProfit?: number;
  }) => {
    webSocketService.placeOrder(order);
  };

  // Cancel an order via WebSocket
  const cancelOrder = (orderId: string) => {
    webSocketService.cancelOrder(orderId);
  };

  return {
    isConnected,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    placeOrder,
    cancelOrder,
  };
}
