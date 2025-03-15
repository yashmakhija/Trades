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
  lastError: string | null;
  lastHeartbeat: number;

  // Market data
  tickerData: Record<string, TickerData>;
  candleData: Record<string, CandleData[]>;

  // Subscriptions
  subscribedSymbols: Set<string>;
  activeSymbol: string | null;

  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Subscription methods
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  setActiveSymbol: (symbol: string) => void;

  // Internal methods
  setConnectionState: (state: ConnectionState) => void;
  setLastError: (error: string | null) => void;
  updateTickerData: (data: Record<string, TickerData>) => void;
  updateCandleData: (symbol: string, data: CandleData[]) => void;
}

// Create a singleton WebSocket instance
let socketInstance: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;

// Create WebSocket store
export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  // Handle WebSocket messages
  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      // Update last heartbeat timestamp
      set({ lastHeartbeat: Date.now() });

      // Only log non-heartbeat messages to reduce console noise
      if (message.type !== "PONG") {
        console.log("WebSocket: Received message type:", message.type);
      }

      switch (message.type) {
        case "INITIAL_DATA":
          // Type assertion to ensure compatibility
          console.log(
            "WebSocket: Received initial data for symbols:",
            Object.keys(message.data).join(", ")
          );
          set({
            tickerData: message.data as Record<string, TickerData>,
            lastError: null,
          });
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

        case "RAW_DATA":
          if (message.symbol && message.data) {
            const symbolKey = message.symbol.toLowerCase();
            const rawData = message.data;

            // Handle different types of Binance WebSocket messages
            if (rawData.e === "24hrTicker") {
              // Update ticker data
              const tickerUpdate: TickerData = {
                symbol: symbolKey,
                price: parseFloat(rawData.c),
                priceChangePercent: parseFloat(rawData.P),
                volume: parseFloat(rawData.v),
                timestamp: rawData.E,
              };

              set((state) => ({
                tickerData: {
                  ...state.tickerData,
                  [symbolKey]: tickerUpdate,
                },
              }));

              // Create a candle update from the ticker data
              const now = Math.floor(Date.now() / 1000);
              const existingData = get().candleData[symbolKey] || [];

              // Only update if this is the active symbol or we don't have many candles yet
              // This prevents unnecessary updates for non-viewed symbols
              if (
                symbolKey === get().activeSymbol ||
                existingData.length < 10
              ) {
                let updatedCandleData = [...existingData];

                // If we have existing candles, update the latest one
                if (updatedCandleData.length > 0) {
                  const latestCandle =
                    updatedCandleData[updatedCandleData.length - 1];
                  const currentPrice = parseFloat(rawData.c);

                  // Update the latest candle with new price data
                  const updatedCandle: CandleData = {
                    time: latestCandle.time,
                    open: latestCandle.open,
                    high: Math.max(latestCandle.high, currentPrice),
                    low: Math.min(latestCandle.low, currentPrice),
                    close: currentPrice,
                    volume: latestCandle.volume,
                  };

                  updatedCandleData[updatedCandleData.length - 1] =
                    updatedCandle;

                  // Broadcast the candle update
                  set((state) => ({
                    candleData: {
                      ...state.candleData,
                      [symbolKey]: updatedCandleData,
                    },
                  }));
                } else if (existingData.length === 0) {
                  // If we don't have any candles yet, create a new one
                  const currentPrice = parseFloat(rawData.c);
                  const newCandle: CandleData = {
                    time: now,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: parseFloat(rawData.v),
                  };

                  updatedCandleData = [newCandle];

                  // Broadcast the new candle
                  set((state) => ({
                    candleData: {
                      ...state.candleData,
                      [symbolKey]: updatedCandleData,
                    },
                  }));
                }
              }
            } else if (rawData.e === "kline") {
              // Handle kline/candlestick data
              if (rawData.k) {
                const kline = rawData.k;

                // Only process if this is the active symbol
                if (symbolKey === get().activeSymbol) {
                  const candle: CandleData = {
                    time: Math.floor(kline.t / 1000), // Convert to seconds for TradingView
                    open: parseFloat(kline.o),
                    high: parseFloat(kline.h),
                    low: parseFloat(kline.l),
                    close: parseFloat(kline.c),
                    volume: parseFloat(kline.v),
                  };

                  set((state) => {
                    const existingData = state.candleData[symbolKey] || [];

                    // Update existing candle or add new one
                    const updatedData = [...existingData];
                    const existingIndex = updatedData.findIndex(
                      (c) => c.time === candle.time
                    );

                    if (existingIndex >= 0) {
                      updatedData[existingIndex] = candle;
                    } else {
                      updatedData.push(candle);
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
              }
            } else if (rawData.e === "trade") {
              // Handle individual trade data
              // Only update ticker for active symbol to reduce state updates
              if (symbolKey === get().activeSymbol) {
                const tradePrice = parseFloat(rawData.p);

                // Update ticker with latest trade price
                set((state) => {
                  const currentTicker = state.tickerData[symbolKey] || {
                    symbol: symbolKey,
                    price: 0,
                    priceChangePercent: 0,
                    volume: 0,
                    timestamp: Date.now(),
                  };

                  return {
                    tickerData: {
                      ...state.tickerData,
                      [symbolKey]: {
                        ...currentTicker,
                        price: tradePrice,
                        timestamp: rawData.T,
                      },
                    },
                  };
                });
              }
            }
          }
          break;

        case "OHLCV_UPDATE":
          if (message.symbol && message.data) {
            const symbolKey = message.symbol as string;

            // Only process if this is the active symbol
            if (
              symbolKey === get().activeSymbol ||
              symbolKey.toLowerCase() === get().activeSymbol
            ) {
              const candleData = message.data as CandleData;

              // Ensure the time is a number (timestamp in seconds)
              if (typeof candleData.time !== "number") {
                // If it's a string ISO date, convert to timestamp
                if (typeof candleData.time === "string") {
                  candleData.time = Math.floor(
                    new Date(candleData.time).getTime() / 1000
                  );
                } else {
                  // If it's something else, use current time
                  candleData.time = Math.floor(Date.now() / 1000);
                }
              }

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
          }
          break;

        case "SUBSCRIPTION_SUCCESS":
          console.log(
            `WebSocket: Successfully subscribed to ${message.symbol}`
          );
          set({ lastError: null });
          break;

        case "UNSUBSCRIPTION_SUCCESS":
          console.log(
            `WebSocket: Successfully unsubscribed from ${message.symbol}`
          );
          break;

        case "ERROR":
          console.error("WebSocket: Error message received:", message.data);
          set({ lastError: message.data?.message || "Unknown error" });
          break;

        case "PONG":
          // Heartbeat response received - already updated lastHeartbeat
          break;

        default:
          console.log("WebSocket: Unhandled message type:", message.type);
      }
    } catch (error) {
      console.error("WebSocket: Error handling message:", error);
      set({
        lastError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    // Don't create a new connection if one already exists and is open/connecting
    if (
      socketInstance &&
      (socketInstance.readyState === WebSocket.OPEN ||
        socketInstance.readyState === WebSocket.CONNECTING)
    ) {
      console.log(
        "WebSocket: Connection already exists, not creating a new one"
      );
      return;
    }

    // Close existing socket if in a bad state
    if (socketInstance) {
      console.log(
        "WebSocket: Closing existing connection before creating a new one"
      );
      socketInstance.close();
      socketInstance = null;
    }

    console.log(`WebSocket: Connecting to ${WS_BASE_URL}`);
    set({ connectionState: "connecting", lastError: null });

    try {
      socketInstance = new WebSocket(WS_BASE_URL);

      socketInstance.onopen = () => {
        console.log("WebSocket: Connection established");
        set({
          connectionState: "connected",
          lastError: null,
          lastHeartbeat: Date.now(),
        });
        reconnectAttempts = 0;

        // Subscribe to all symbols in the subscription set
        const { subscribedSymbols } = get();
        if (subscribedSymbols.size > 0) {
          console.log(
            `WebSocket: Resubscribing to ${subscribedSymbols.size} symbols:`,
            Array.from(subscribedSymbols).join(", ")
          );

          // Subscribe to each symbol
          subscribedSymbols.forEach((symbol) => {
            if (
              socketInstance &&
              socketInstance.readyState === WebSocket.OPEN
            ) {
              console.log(`WebSocket: Sending subscription for ${symbol}`);
              socketInstance.send(
                JSON.stringify({
                  type: "SUBSCRIBE",
                  symbol,
                })
              );
            }
          });
        }

        // Setup heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(() => {
          if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
            socketInstance.send(JSON.stringify({ type: "PING" }));

            // Check if we've received a response since the last ping
            const lastHeartbeat = get().lastHeartbeat;
            const now = Date.now();

            // If no heartbeat for more than 2x the interval, reconnect
            if (now - lastHeartbeat > WS_HEARTBEAT_INTERVAL_MS * 2) {
              console.warn(
                `WebSocket: No heartbeat received for ${
                  (now - lastHeartbeat) / 1000
                }s, reconnecting...`
              );

              // Force reconnection
              if (socketInstance) {
                socketInstance.close();
                socketInstance = null;
              }

              setupWebSocket();
            }
          }
        }, WS_HEARTBEAT_INTERVAL_MS);
      };

      socketInstance.onmessage = handleMessage;

      socketInstance.onclose = (event) => {
        console.log(
          `WebSocket: Disconnected with code: ${event.code}, reason: ${event.reason}`
        );
        set({
          connectionState: "disconnected",
          lastError: event.reason || "Connection closed",
        });

        // Clear heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        // Attempt reconnection
        if (reconnectAttempts < WS_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay =
            WS_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
          console.log(
            `WebSocket: Reconnecting... Attempt ${reconnectAttempts} in ${delay}ms`
          );
          setTimeout(setupWebSocket, delay);
        } else {
          console.error("WebSocket: Max reconnection attempts reached");
        }
      };

      socketInstance.onerror = (error) => {
        console.error("WebSocket: Error:", error);
        set({ lastError: "WebSocket connection error" });
      };
    } catch (error) {
      console.error("WebSocket: Setup error:", error);
      set({
        connectionState: "disconnected",
        lastError: error instanceof Error ? error.message : "Unknown error",
      });

      // Attempt reconnection after error
      if (reconnectAttempts < WS_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay =
          WS_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
        console.log(
          `WebSocket: Reconnecting after error... Attempt ${reconnectAttempts} in ${delay}ms`
        );
        setTimeout(setupWebSocket, delay);
      }
    }
  };

  return {
    // State
    connectionState: "disconnected",
    lastError: null,
    lastHeartbeat: 0,
    tickerData: {},
    candleData: {},
    subscribedSymbols: new Set<string>(),
    activeSymbol: null,

    // Connection methods
    connect: () => {
      console.log("WebSocket: Connect method called");
      setupWebSocket();
    },

    disconnect: () => {
      if (socketInstance) {
        socketInstance.close();
        socketInstance = null;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      set({ connectionState: "disconnected" });
    },

    // Subscription methods
    subscribeToSymbol: (symbol) => {
      const normalizedSymbol = symbol.toLowerCase();
      const { subscribedSymbols, connectionState } = get();

      // Check if already subscribed
      if (subscribedSymbols.has(normalizedSymbol)) {
        console.log(`WebSocket: Already subscribed to ${normalizedSymbol}`);
        return;
      }

      console.log(`WebSocket: Subscribing to symbol: ${normalizedSymbol}`);

      // Add to subscribed symbols set
      set((state) => ({
        subscribedSymbols: new Set([
          ...state.subscribedSymbols,
          normalizedSymbol,
        ]),
        // Set as active symbol if we don't have one yet
        activeSymbol: state.activeSymbol || normalizedSymbol,
      }));

      // Send subscription message if connected
      if (socketInstance && connectionState === "connected") {
        console.log(
          `WebSocket: Sending subscription message for ${normalizedSymbol}`
        );
        socketInstance.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            symbol: normalizedSymbol,
          })
        );
      } else {
        console.log(
          `WebSocket: Will subscribe to ${normalizedSymbol} when connected (current state: ${connectionState})`
        );

        // If not connected, try to connect
        if (connectionState === "disconnected") {
          console.log("WebSocket: Not connected, initiating connection");
          setupWebSocket();
        }
      }
    },

    unsubscribeFromSymbol: (symbol) => {
      const normalizedSymbol = symbol.toLowerCase();
      const { subscribedSymbols, connectionState, activeSymbol } = get();

      // Check if not subscribed
      if (!subscribedSymbols.has(normalizedSymbol)) {
        console.log(`WebSocket: Not subscribed to ${normalizedSymbol}`);
        return;
      }

      console.log(`WebSocket: Unsubscribing from symbol: ${normalizedSymbol}`);

      // Remove from subscribed symbols set
      const newSubscribedSymbols = new Set(subscribedSymbols);
      newSubscribedSymbols.delete(normalizedSymbol);

      // Update active symbol if needed
      let newActiveSymbol = activeSymbol;
      if (activeSymbol === normalizedSymbol) {
        newActiveSymbol =
          newSubscribedSymbols.size > 0
            ? Array.from(newSubscribedSymbols)[0]
            : null;
      }

      set({
        subscribedSymbols: newSubscribedSymbols,
        activeSymbol: newActiveSymbol,
      });

      // Send unsubscription message if connected
      if (socketInstance && connectionState === "connected") {
        console.log(
          `WebSocket: Sending unsubscription message for ${normalizedSymbol}`
        );
        socketInstance.send(
          JSON.stringify({
            type: "UNSUBSCRIBE",
            symbol: normalizedSymbol,
          })
        );
      }
    },

    setActiveSymbol: (symbol) => {
      const normalizedSymbol = symbol.toLowerCase();
      const { subscribedSymbols } = get();

      // Make sure we're subscribed to this symbol
      if (!subscribedSymbols.has(normalizedSymbol)) {
        console.log(
          `WebSocket: Auto-subscribing to new active symbol: ${normalizedSymbol}`
        );
        get().subscribeToSymbol(normalizedSymbol);
      }

      console.log(`WebSocket: Setting active symbol to ${normalizedSymbol}`);
      set({ activeSymbol: normalizedSymbol });
    },

    // Internal methods
    setConnectionState: (state: ConnectionState) => {
      set({ connectionState: state });
    },

    setLastError: (error: string | null) => {
      set({ lastError: error });
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
  setActiveSymbol: (symbol: string) =>
    useWebSocketStore.getState().setActiveSymbol(symbol),
  getConnectionState: () => useWebSocketStore.getState().connectionState,
  getLastError: () => useWebSocketStore.getState().lastError,
};

// Auto-connect when this module is imported
if (typeof window !== "undefined") {
  console.log("WebSocket: Auto-connecting on module import");
  // Use a small delay to ensure the module is fully loaded
  setTimeout(() => {
    console.log("WebSocket: Initializing connection");
    websocketService.connect();
  }, 100);
}
