"use client";

import { useAuthStore } from "@/store/use-auth-store";
import { useMarketStore } from "@/store/use-market-store";
import { Order, useOrderStore } from "@/store/use-order-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private subscribedSymbols: Set<string> = new Set();

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
  }

  private handleOpen() {
    console.log("WebSocket connected");
    useMarketStore.getState().setIsConnected(true);
    this.reconnectAttempts = 0;

    // Authenticate if token exists
    const token = useAuthStore.getState().token;
    if (token) {
      this.send({
        type: "authenticate",
        token,
      });
    }

    // Resubscribe to symbols
    if (this.subscribedSymbols.size > 0) {
      this.send({
        type: "subscribe",
        symbols: Array.from(this.subscribedSymbols),
      });
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      switch (message.type) {
        case "price_update":
          this.handlePriceUpdate(message);
          break;
        case "order_update":
          this.handleOrderUpdate(message);
          break;
        case "balance_update":
          this.handleBalanceUpdate(message);
          break;
        default:
          console.log("Unhandled message type:", message.type);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log("WebSocket disconnected:", event.code, event.reason);
    useMarketStore.getState().setIsConnected(false);

    // Attempt to reconnect if not a clean close
    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectDelay);
    }
  }

  private handleError(error: Event) {
    console.error("WebSocket error:", error);
  }

  private handlePriceUpdate(message: WebSocketMessage) {
    const symbolId = message.symbol as string;
    const price = message.price as number;

    // Use the new addPriceUpdate method instead of updatePrice
    useMarketStore.getState().addPriceUpdate(symbolId, price);
  }

  private handleOrderUpdate(message: WebSocketMessage) {
    const order = message.order as Order;
    const orderStore = useOrderStore.getState();

    if (order.status === "OPEN") {
      orderStore.addOrder(order);
    } else {
      orderStore.updateOrder(order);
    }
  }

  private handleBalanceUpdate(message: WebSocketMessage) {
    useOrderStore.getState().setBalance(message.balance as any);
  }

  subscribe(symbol: string) {
    this.subscribedSymbols.add(symbol);

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({
        type: "subscribe",
        symbols: [symbol],
      });
    }
  }

  unsubscribe(symbol: string) {
    this.subscribedSymbols.delete(symbol);

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({
        type: "unsubscribe",
        symbols: [symbol],
      });
    }
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
    this.send({
      type: "place_order",
      order,
    });
  }

  cancelOrder(orderId: string) {
    this.send({
      type: "cancel_order",
      orderId,
    });
  }

  private send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message");
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();
