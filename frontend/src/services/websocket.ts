import { create } from "zustand";
import {
  WS_BASE_URL,
  WS_RECONNECT_ATTEMPTS,
  WS_RECONNECT_DELAY_MS,
  WS_HEARTBEAT_INTERVAL_MS,
} from "@/config";

// Define types for market data
export interface TickerData {
  symbol: string;
  price: number;
  priceChangePercent: number;
  volume: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

// WebSocket message types
interface WebSocketMessage {
  type: string;
  // Using any here is a pragmatic choice due to the varied message formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  symbol?: string;
}

// WebSocket connection states
type ConnectionState = "disconnected" | "connecting" | "connected";

// WebSocket store interface
interface WebSocketStore {
  // Connection state
  connectionState: ConnectionState;

  // Market data
  tickerData: Record<string, TickerData>;
  candleData: Record<string, CandleData[]>;

  // Subscriptions
  subscribedSymbols: Set<string>;

  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Subscription methods
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;

  // Internal methods
  setConnectionState: (state: ConnectionState) => void;
  updateTickerData: (data: Record<string, TickerData>) => void;
  updateCandleData: (symbol: string, data: CandleData[]) => void;
}

// Create WebSocket store
export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  // WebSocket instance
  let socket: WebSocket | null = null;

  // Reconnection settings
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = WS_RECONNECT_ATTEMPTS;
  const RECONNECT_DELAY = WS_RECONNECT_DELAY_MS;

  // Heartbeat interval
  let heartbeatInterval: NodeJS.Timeout | null = null;

  // Handle WebSocket messages
  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      switch (message.type) {
        case "INITIAL_DATA":
          // Type assertion to ensure compatibility
          set({ tickerData: message.data as Record<string, TickerData> });
          break;

        case "TICKER_UPDATE":
          if (message.symbol && message.data) {
            const symbolKey = message.symbol as string;
            set((state) => ({
              tickerData: {
                ...state.tickerData,
                [symbolKey]: message.data as TickerData,
              },
            }));
          }
          break;

        case "OHLCV_UPDATE":
          if (message.symbol && message.data) {
            const symbolKey = message.symbol as string;
            const candleData = message.data as CandleData;

            set((state) => {
              const existingData = state.candleData[symbolKey] || [];

              // Update existing candle or add new one
              const updatedData = [...existingData];
              const existingIndex = updatedData.findIndex(
                (candle) => candle.time === candleData.time
              );

              if (existingIndex >= 0) {
                updatedData[existingIndex] = candleData;
              } else {
                updatedData.push(candleData);
                // Sort by time
                updatedData.sort((a, b) => a.time - b.time);
              }

              return {
                candleData: {
                  ...state.candleData,
                  [symbolKey]: updatedData,
                },
              };
            });
          }
          break;

        case "SUBSCRIPTION_SUCCESS":
          console.log(`Successfully subscribed to ${message.symbol}`);
          break;

        case "UNSUBSCRIPTION_SUCCESS":
          console.log(`Successfully unsubscribed from ${message.symbol}`);
          break;

        case "PONG":
          // Heartbeat response received
          break;

        default:
          console.log("Unhandled message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    const { connectionState } = get();

    if (connectionState === "connected" || connectionState === "connecting") {
      return;
    }

    set({ connectionState: "connecting" });

    // Close existing socket if any
    if (socket) {
      socket.close();
    }

    // Create new WebSocket connection using the configured URL
    socket = new WebSocket(WS_BASE_URL);

    // Setup event handlers
    socket.onopen = () => {
      console.log("WebSocket connected");
      set({ connectionState: "connected" });
      reconnectAttempts = 0;

      // Subscribe to symbols
      const { subscribedSymbols } = get();
      subscribedSymbols.forEach((symbol) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "SUBSCRIBE",
              symbol,
            })
          );
        }
      });

      // Setup heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "PING" }));
        }
      }, WS_HEARTBEAT_INTERVAL_MS);
    };

    socket.onmessage = handleMessage;

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      set({ connectionState: "disconnected" });

      // Clear heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting... Attempt ${reconnectAttempts}`);
        setTimeout(setupWebSocket, RECONNECT_DELAY);
      } else {
        console.error("Max reconnection attempts reached");
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  return {
    // State
    connectionState: "disconnected",
    tickerData: {},
    candleData: {},
    subscribedSymbols: new Set<string>(),

    // Connection methods
    connect: () => {
      setupWebSocket();
    },

    disconnect: () => {
      if (socket) {
        socket.close();
        socket = null;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      set({ connectionState: "disconnected" });
    },

    // Subscription methods
    subscribeToSymbol: (symbol: string) => {
      const { subscribedSymbols, connectionState } = get();

      // Add to subscribed symbols
      subscribedSymbols.add(symbol.toLowerCase());
      set({ subscribedSymbols: new Set(subscribedSymbols) });

      // Send subscription message if connected
      if (connectionState === "connected" && socket) {
        socket.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            symbol: symbol.toLowerCase(),
          })
        );
      }
    },

    unsubscribeFromSymbol: (symbol: string) => {
      const { subscribedSymbols, connectionState } = get();

      // Remove from subscribed symbols
      subscribedSymbols.delete(symbol.toLowerCase());
      set({ subscribedSymbols: new Set(subscribedSymbols) });

      // Send unsubscription message if connected
      if (connectionState === "connected" && socket) {
        socket.send(
          JSON.stringify({
            type: "UNSUBSCRIBE",
            symbol: symbol.toLowerCase(),
          })
        );
      }
    },

    // Internal methods
    setConnectionState: (state: ConnectionState) => {
      set({ connectionState: state });
    },

    updateTickerData: (data: Record<string, TickerData>) => {
      set({ tickerData: data });
    },

    updateCandleData: (symbol: string, data: CandleData[]) => {
      set((state) => ({
        candleData: {
          ...state.candleData,
          [symbol]: data,
        },
      }));
    },
  };
});

// Export singleton instance
export const websocketService = {
  connect: () => useWebSocketStore.getState().connect(),
  disconnect: () => useWebSocketStore.getState().disconnect(),
  subscribeToSymbol: (symbol: string) =>
    useWebSocketStore.getState().subscribeToSymbol(symbol),
  unsubscribeFromSymbol: (symbol: string) =>
    useWebSocketStore.getState().unsubscribeFromSymbol(symbol),
};

// Auto-connect when this module is imported
if (typeof window !== "undefined") {
  setTimeout(() => {
    websocketService.connect();
  }, 0);
}
