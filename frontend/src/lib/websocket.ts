"use client";

// This file is kept for backward compatibility
// It now uses the improved WebSocket implementation from services/websocket.ts
// to prevent multiple competing WebSocket connections

import { useWebSocketStore } from "@/services/websocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

class WebSocketService {
  // This is a proxy class that delegates to the improved WebSocket store
  private store = useWebSocketStore.getState();

  connect() {
    console.log("WebSocketService: Using improved WebSocket implementation");
    this.store.connect();
  }

  subscribe(symbol: string) {
    this.store.subscribeToSymbol(symbol);
  }

  unsubscribe(symbol: string) {
    this.store.unsubscribeFromSymbol(symbol);
  }

  placeOrder(order: {
    symbol: string;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    isShort: boolean;
    stopLoss?: number;
    takeProfit?: number;
  }) {
    // Use the store's connection to send order
    useWebSocketStore.getState().subscribeToSymbol(order.symbol);

    // Send order through global WebSocket
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ws-send", {
          detail: {
            type: "place_order",
            order,
          },
        })
      );
    }
  }

  cancelOrder(orderId: string) {
    // Send cancel order through global WebSocket
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ws-send", {
          detail: {
            type: "cancel_order",
            orderId,
          },
        })
      );
    }
  }

  disconnect() {
    // Don't actually disconnect as we want to maintain a persistent connection
    console.log(
      "WebSocketService: Disconnect requested but ignored to maintain persistent connection"
    );
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();

// Initialize connection
webSocketService.connect();
