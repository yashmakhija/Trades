import { create } from "zustand";
import {
  WS_BASE_URL,
  WS_RECONNECT_ATTEMPTS,
  WS_RECONNECT_DELAY_MS,
  WS_HEARTBEAT_INTERVAL_MS,
} from "@/config";
import { Position } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";

// Define types for market data
export interface TickerData {
  symbol: string;
  price: number;
  priceChangePercent: number;
  volume: number;
  timestamp: number;
  high?: number; // 24h high price
  low?: number; // 24h low price
  openPrice?: number; // 24h open price
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
}

// Add new message types
export interface BalanceUpdate {
  total: number;
  available: number;
  reserved: number;
  positions: Position[];
  totalValue: number;
  totalPnl: number;
  totalPositionValue: number;
  openOrdersCount: number;
}

export interface OrderUpdate {
  orderId: string;
  symbol: string;
  type: "MARKET" | "LIMIT";
  side: "BUY" | "SELL";
  status: "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
  quantity: number;
  price: number;
  filledQuantity: number;
  averagePrice: number;
  timestamp: number;
}

// WebSocket message types
interface WebSocketMessage {
  type: string;
  // Using any here is a pragmatic choice due to the varied message formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  symbol?: string;
  timeframe?: string;
  userId?: string;
  error?: string;
  authenticated?: boolean;
}

// WebSocket connection states
type ConnectionState = "disconnected" | "connecting" | "connected";

// WebSocket store interface
interface WebSocketStore {
  // Connection state
  connectionState: ConnectionState;
  lastError: string | null;
  lastHeartbeat: number;
  isAuthenticated: boolean;

  // Market data
  tickerData: Record<string, TickerData>;
  candleData: Record<string, Record<string, CandleData[]>>;

  // Subscriptions
  subscribedSymbols: Set<string>;
  subscribedCandles: Map<string, Set<string>>;
  activeSymbol: string | null;
  activeTimeframe: string;

  // Balance and Order data
  balance: BalanceUpdate | null;
  orders: Record<string, OrderUpdate>;

  // Connection methods
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Subscription methods
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  subscribeToCandles: (symbol: string, timeframe: string) => void;
  unsubscribeFromCandles: (symbol: string, timeframe: string) => void;
  setActiveSymbol: (symbol: string) => void;
  setActiveTimeframe: (timeframe: string) => void;

  // Internal methods
  setConnectionState: (state: ConnectionState) => void;
  setLastError: (error: string | null) => void;
  updateTickerData: (data: Record<string, TickerData>) => void;
  updateCandleData: (
    symbol: string,
    timeframe: string,
    data: CandleData[]
  ) => void;
  appendCandleData: (
    symbol: string,
    timeframe: string,
    candle: CandleData
  ) => void;

  // Additional methods
  updateBalance: (balance: BalanceUpdate) => void;
  updateOrder: (order: OrderUpdate) => void;
  removeOrder: (orderId: string) => void;
}

// Create a singleton instance to control the WebSocket connection
let globalSocketInstance: WebSocket | null = null;
let globalReconnectTimeout: NodeJS.Timeout | null = null;
let globalHeartbeatInterval: NodeJS.Timeout | null = null;
let globalReconnectAttempts = 0;
let globalIsReconnecting = false;
let globalLastPongReceived = Date.now();

// Create WebSocket store
export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  const checkConnectionHealth = () => {
    const now = Date.now();
    const timeSinceLastPong = now - globalLastPongReceived;

    if (timeSinceLastPong > 45000 && globalSocketInstance) {
      console.log(
        "WebSocket: Connection unhealthy, no pong received for",
        timeSinceLastPong,
        "ms"
      );
      reconnect();
      return;
    }

    if (globalSocketInstance) {
      switch (globalSocketInstance.readyState) {
        case WebSocket.CLOSED:
        case WebSocket.CLOSING:
          console.log(
            "WebSocket: Connection is closed or closing, reconnecting"
          );
          reconnect();
          break;
        case WebSocket.CONNECTING:
          if (
            get().connectionState === "connecting" &&
            timeSinceLastPong > 10000
          ) {
            console.log(
              "WebSocket: Stuck in connecting state, attempting to reconnect"
            );
            reconnect();
          }
          break;
      }
    } else if (get().connectionState !== "connecting") {
      console.log(
        "WebSocket: No socket instance but not connecting, reconnecting"
      );
      reconnect();
    }
  };

  const setupHeartbeat = () => {
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
    }

    globalHeartbeatInterval = setInterval(() => {
      if (
        globalSocketInstance &&
        globalSocketInstance.readyState === WebSocket.OPEN
      ) {
        try {
          globalSocketInstance.send(JSON.stringify({ type: "PING" }));
        } catch (e) {
          console.error("Error sending PING:", e);
        }

        // Check connection health on every heartbeat
        checkConnectionHealth();
      }
    }, WS_HEARTBEAT_INTERVAL_MS);
  };

  // Setup WebSocket connection
  const connect = () => {
    console.log("WebSocket: Connect method called");

    // Don't create a new connection if one already exists
    if (
      globalSocketInstance &&
      (globalSocketInstance.readyState === WebSocket.OPEN ||
        globalSocketInstance.readyState === WebSocket.CONNECTING)
    ) {
      console.log(
        "WebSocket: Connection already exists, not creating a new one"
      );
      return;
    }

    // Get authentication state
    const { token, isAuthenticated } = useAuthStore.getState();

    console.log(
      `WebSocket: ${
        isAuthenticated ? "Authenticated" : "Non-authenticated"
      } connection`
    );

    // Reset connection state
    set({
      connectionState: "connecting",
      lastError: null,
    });

    try {
      // Initialize reconnection counter
      globalReconnectAttempts = 0;

      // Create WebSocket connection
      globalSocketInstance = new WebSocket(WS_BASE_URL);

      // Set up event handlers
      globalSocketInstance.onopen = () => {
        console.log("WebSocket: Connection established");

        // Reset pong timestamp on successful connection
        globalLastPongReceived = Date.now();

        if (globalReconnectTimeout) {
          clearTimeout(globalReconnectTimeout);
          globalReconnectTimeout = null;
        }

        // Set connection state
        set({ connectionState: "connected" });

        // Authenticate if user is logged in
        if (isAuthenticated && token) {
          console.log("WebSocket: Sending authentication token");
          globalSocketInstance?.send(
            JSON.stringify({
              type: "AUTHENTICATE",
              token,
            })
          );
        } else {
          console.log(
            "WebSocket: Proceeding with non-authenticated connection"
          );
          set({ isAuthenticated: false });
        }

        // Resubscribe to active symbols if needed
        const { subscribedSymbols, activeSymbol } = get();

        // Add current active symbol to subscriptions if not already there
        if (activeSymbol && !subscribedSymbols.has(activeSymbol)) {
          const newSubscribedSymbols = new Set(subscribedSymbols);
          newSubscribedSymbols.add(activeSymbol);
          set({ subscribedSymbols: newSubscribedSymbols });
        }

        if (subscribedSymbols.size > 0) {
          console.log(
            `WebSocket: Resubscribing to ${subscribedSymbols.size} symbols:`,
            Array.from(subscribedSymbols)
          );

          subscribedSymbols.forEach((symbol) => {
            globalSocketInstance?.send(
              JSON.stringify({
                type: "SUBSCRIBE",
                symbol,
              })
            );
          });
        } else {
          console.log("WebSocket: No symbols to resubscribe to");
        }

        // Setup heartbeat with health checks
        setupHeartbeat();
      };

      globalSocketInstance.onmessage = (event) => {
        // Update activity timestamps
        globalLastPongReceived = Date.now();

        // Fast-path for PING messages to respond immediately without any processing delay
        try {
          const data = event.data;
          if (typeof data === "string" && data.includes('"type":"PING"')) {
            // Immediately respond with PONG without parsing JSON
            if (
              globalSocketInstance &&
              globalSocketInstance.readyState === WebSocket.OPEN
            ) {
              globalSocketInstance.send(JSON.stringify({ type: "PONG" }));
              console.log("WebSocket: Immediately responded to PING with PONG");
            }
          }
        } catch (e) {
          // Ignore errors in the fast path
        }

        // Regular processing path
        handleMessage(event);
      };

      globalSocketInstance.onerror = (error) => {
        console.error("WebSocket: Connection error", error);
        set({
          connectionState: "disconnected",
          lastError: "Connection error",
        });
      };

      globalSocketInstance.onclose = (event) => {
        console.log(
          `WebSocket: Connection closed (${event.code}) - ${
            event.reason || "No reason provided"
          }`
        );

        // Reset connection state
        set({
          connectionState: "disconnected",
          isAuthenticated: false,
        });

        // Determine if this is an abnormal closure
        // (1006 is abnormal closure often caused by server restarts)
        const isAbnormalClosure = event.code === 1006 || event.code === 1001;
        const shouldReconnectImmediately = isAbnormalClosure;

        // Clear intervals
        if (globalHeartbeatInterval) {
          clearInterval(globalHeartbeatInterval);
          globalHeartbeatInterval = null;
        }

        // Check if we should attempt to reconnect - use exponential backoff
        if (!globalIsReconnecting) {
          if (shouldReconnectImmediately) {
            console.log(
              `WebSocket: Abnormal closure (${event.code}), reconnecting immediately`
            );
            // Try to reconnect immediately for abnormal closures
            if (globalReconnectTimeout) {
              clearTimeout(globalReconnectTimeout);
            }
            globalReconnectTimeout = setTimeout(reconnect, 1000);
          } else if (globalReconnectAttempts < WS_RECONNECT_ATTEMPTS) {
            globalReconnectAttempts++;
            console.log(
              `WebSocket: Reconnecting after close... Attempt ${globalReconnectAttempts} in ${WS_RECONNECT_DELAY_MS}ms`
            );

            globalReconnectTimeout = setTimeout(() => {
              // Only reconnect if we haven't already started reconnecting
              if (!globalIsReconnecting) {
                reconnect();
              }
            }, WS_RECONNECT_DELAY_MS);
          } else if (globalReconnectAttempts >= WS_RECONNECT_ATTEMPTS) {
            console.log(
              `WebSocket: Max reconnection attempts (${WS_RECONNECT_ATTEMPTS}) reached`
            );
            set({
              lastError: "Max reconnection attempts reached",
            });

            globalReconnectTimeout = setTimeout(() => {
              console.log(
                "WebSocket: Continuing to try reconnecting after delay"
              );
              globalReconnectAttempts = 0;
              reconnect();
            }, 60000); 
          }
        }
      };
    } catch (error) {
      console.error("WebSocket: Error creating connection", error);
      set({
        connectionState: "disconnected",
        lastError: "Error creating connection",
      });
    }
  };

  // Reconnect to WebSocket with current auth token
  const reconnect = () => {
    // Close existing connection if it's open
    if (globalSocketInstance) {
      if (globalSocketInstance.readyState === WebSocket.OPEN) {
        globalSocketInstance.close();
      }
      globalSocketInstance = null;
    }

    // Clear any existing intervals or timeouts
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
      globalHeartbeatInterval = null;
    }

    if (globalReconnectTimeout) {
      clearTimeout(globalReconnectTimeout);
      globalReconnectTimeout = null;
    }

    // Wait a moment to ensure the connection is closed
    setTimeout(() => {
      globalIsReconnecting = true;
      console.log("WebSocket: Reconnecting with new connection");

      // Set up a new connection
      set({ connectionState: "connecting" });
      connect();

      // Reset reconnecting flag
      setTimeout(() => {
        globalIsReconnecting = false;
      }, 1000);
    }, 500);
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (globalSocketInstance) {
      globalSocketInstance.close();
      globalSocketInstance = null;
    }

    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
      globalHeartbeatInterval = null;
    }

    if (globalReconnectTimeout) {
      clearTimeout(globalReconnectTimeout);
      globalReconnectTimeout = null;
    }

    set({
      connectionState: "disconnected",
      isAuthenticated: false,
    });
  };

  // Handle WebSocket messages
  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      // Don't log every PING/PONG message to reduce console noise
      if (message.type !== "PING" && message.type !== "PONG") {
        console.log("WebSocket: Received message:", message.type);
      }

      // Update last heartbeat time
      set({ lastHeartbeat: Date.now() });

      // Handle PING messages from server by responding with PONG
      if (message.type === "PING") {
        // We've already sent the PONG in the fast path, but here's a fallback
        if (
          globalSocketInstance &&
          globalSocketInstance.readyState === WebSocket.OPEN
        ) {
          globalSocketInstance.send(JSON.stringify({ type: "PONG" }));
        }
        return;
      }

      // Handle PONG responses explicitly
      if (message.type === "PONG") {
        globalLastPongReceived = Date.now();
        return;
      }

      switch (message.type) {
        case "CONNECTION_SUCCESS":
          console.log("WebSocket: Connection success", message);
          set({
            isAuthenticated: message.authenticated || false,
            connectionState: "connected",
          });
          break;

        case "AUTHENTICATION_SUCCESS":
          console.log("WebSocket: Authentication success", message);
          set({ isAuthenticated: true });
          break;

        case "AUTH_ERROR":
          console.error("WebSocket: Authentication error", message.error);
          set({
            lastError: message.error || "Authentication failed",
            isAuthenticated: false,
          });
          break;

        case "INITIAL_DATA":
          console.log("WebSocket: Received initial market data");
          if (message.data) {
            const tickerData: Record<string, TickerData> = {};
            Object.entries(message.data).forEach(([symbol, data]) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tickerInfo = data as any;
              tickerData[symbol] = {
                symbol,
                // Convert price from integer to floating-point (divide by 100)
                price:
                  typeof tickerInfo.price === "number"
                    ? tickerInfo.price / 100
                    : tickerInfo.price,
                priceChangePercent: tickerInfo.priceChangePercent || 0,
                volume: tickerInfo.volume || 0,
                timestamp: tickerInfo.timestamp || Date.now(),
              };
            });
            set({ tickerData });
          }
          break;

        case "RAW_DATA":
          if (message.symbol && message.data) {
            const symbol = message.symbol.toLowerCase();
            const rawData = message.data;

            // Log with lower verbosity to reduce processing overhead
            if (Math.random() < 0.01) {
              // Only log ~1% of raw data messages to reduce overhead
              console.log(
                `WebSocket: Processing RAW_DATA for ${symbol}, event type: ${rawData.e}`
              );
            }

            // Handle different types of Binance WebSocket messages
            if (rawData.e === "kline" && rawData.k) {
              const kline = rawData.k;

              // Update ticker data with latest price - using optimized update
              set((state) => {
                const currentTicker = state.tickerData[symbol] || {
                  symbol,
                  price: 0,
                  priceChangePercent: 0,
                  volume: 0,
                  timestamp: Date.now(),
                };

                return {
                  tickerData: {
                    ...state.tickerData,
                    [symbol]: {
                      ...currentTicker,
                      price: parseFloat(kline.c),
                      volume: parseFloat(kline.v),
                      timestamp: rawData.E,
                    },
                  },
                };
              });

              // Create candle data from kline - only if needed
              const activeTimeframe = get().activeTimeframe;
              if (kline.i.toLowerCase() === activeTimeframe) {
                const candle: CandleData = {
                  time: Math.floor(kline.t / 1000), // Convert to seconds for charts
                  open: parseFloat(kline.o),
                  high: parseFloat(kline.h),
                  low: parseFloat(kline.l),
                  close: parseFloat(kline.c),
                  volume: parseFloat(kline.v),
                };

                // Update candle data for active timeframe with minimal processing
                set((state) => {
                  const symbolCandles = state.candleData[symbol] || {};
                  const timeframeCandles = symbolCandles[activeTimeframe] || [];

                  // Check if this candle already exists (same timestamp)
                  const existingIndex = timeframeCandles.findIndex((c) => {
                    const cTime = typeof c.time === "number" ? c.time : 0;
                    const candleTime =
                      typeof candle.time === "number" ? candle.time : 0;
                    return cTime === candleTime;
                  });

                  let updatedCandles;
                  if (existingIndex >= 0) {
                    // Update existing candle
                    updatedCandles = [...timeframeCandles];
                    updatedCandles[existingIndex] = candle;
                  } else {
                    // Add new candle
                    updatedCandles = [...timeframeCandles, candle].sort(
                      (a, b) => {
                        const timeA = typeof a.time === "number" ? a.time : 0;
                        const timeB = typeof b.time === "number" ? b.time : 0;
                        return timeA - timeB;
                      }
                    );
                  }

                  return {
                    candleData: {
                      ...state.candleData,
                      [symbol]: {
                        ...symbolCandles,
                        [activeTimeframe]: updatedCandles,
                      },
                    },
                  };
                });
              }
            } else if (rawData.e === "24hrTicker") {
              // Update ticker data with minimal logging
              set((state) => ({
                tickerData: {
                  ...state.tickerData,
                  [symbol]: {
                    symbol,
                    price: parseFloat(rawData.c),
                    priceChangePercent: parseFloat(rawData.P),
                    volume: parseFloat(rawData.v),
                    timestamp: rawData.E,
                    high: parseFloat(rawData.h),
                    low: parseFloat(rawData.l),
                    openPrice: parseFloat(rawData.o),
                  },
                },
              }));
            } else if (rawData.e === "trade") {
              // Only update the price for trade events
              set((state) => {
                const currentTicker = state.tickerData[symbol];
                if (!currentTicker) return state; // Skip if no existing ticker data

                return {
                  tickerData: {
                    ...state.tickerData,
                    [symbol]: {
                      ...currentTicker,
                      price: parseFloat(rawData.p),
                      timestamp: rawData.T,
                    },
                  },
                };
              });
            }
          }
          break;

        case "TICKER_UPDATE":
          if (message.symbol && message.data) {
            const updates = message.data;
            console.log(
              `WebSocket: Processing TICKER_UPDATE for ${message.symbol}`,
              updates
            );

            set((state) => {
              // Get current ticker data to preserve high/low/open if they already exist
              const currentTicker = state.tickerData[message.symbol!] || {};

              const updatedTicker = {
                symbol: message.symbol!,
                // Check if displayPrice is provided, otherwise convert price from integer to dollars
                price:
                  updates.displayPrice ||
                  (typeof updates.price === "number"
                    ? updates.price / 100
                    : updates.price),
                // Ensure we use the correct price change percentage value
                priceChangePercent: updates.priceChangePercent || 0,
                volume: updates.volume || 0,
                timestamp: updates.timestamp || Date.now(),
                // Preserve existing high/low/open data if not provided in the update
                high: updates.high || currentTicker.high,
                low: updates.low || currentTicker.low,
                openPrice: updates.openPrice || currentTicker.openPrice,
              };

              console.log(
                `WebSocket: Updated ticker for ${message.symbol}`,
                updatedTicker
              );

              return {
                tickerData: {
                  ...state.tickerData,
                  [message.symbol!]: updatedTicker,
                },
              };
            });
          }
          break;

        case "CANDLE_HISTORY":
          if (
            message.symbol &&
            message.timeframe &&
            Array.isArray(message.data)
          ) {
            const candles: CandleData[] = message.data.map((candle) => {
              // Ensure time is in seconds for lightweight-charts
              let normalizedTime: number;
              const rawTime = candle.time;

              // Convert time to a proper timestamp number in seconds
              if (typeof rawTime === "number") {
                // Convert milliseconds to seconds if needed
                normalizedTime =
                  rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
              } else if (typeof rawTime === "string") {
                // Convert string date to seconds
                normalizedTime = Math.floor(new Date(rawTime).getTime() / 1000);
              } else {
                // Default to current time if invalid
                console.warn("Invalid candle time format:", rawTime);
                normalizedTime = Math.floor(Date.now() / 1000);
              }

              return {
                time: normalizedTime,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
              };
            });

            // Sort candles by time to ensure proper order
            candles.sort((a, b) => {
              // Both times should already be normalized numbers at this point
              return (a.time as number) - (b.time as number);
            });

            set((state) => {
              const symbolCandles = state.candleData[message.symbol!] || {};
              return {
                candleData: {
                  ...state.candleData,
                  [message.symbol!]: {
                    ...symbolCandles,
                    [message.timeframe!]: candles,
                  },
                },
              };
            });
          }
          break;

        case "OHLCV_UPDATE":
          if (
            message.symbol &&
            message.timeframe &&
            message.data &&
            typeof message.data === "object"
          ) {
            console.log(
              `Received OHLCV_UPDATE for ${message.symbol}/${message.timeframe}:`,
              message.data
            );

            try {
              // Ensure time is in seconds for lightweight-charts
              let normalizedTime: number;

              // Check for timestamp in different formats
              const rawTime = message.data.time || message.data.timestamp;

              // Convert time to a proper timestamp number in seconds
              if (typeof rawTime === "number") {
                // Convert milliseconds to seconds if needed (timestamps over 10000000000 are in milliseconds)
                normalizedTime =
                  rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
              } else if (typeof rawTime === "string") {
                // Convert string date to seconds
                normalizedTime = Math.floor(new Date(rawTime).getTime() / 1000);
              } else if (rawTime instanceof Date) {
                // Handle Date object
                normalizedTime = Math.floor(rawTime.getTime() / 1000);
              } else {
                console.warn("Invalid candle time format:", rawTime);
                break; // Skip this update if time format is invalid
              }

              // Verify we have a valid number
              if (isNaN(normalizedTime) || normalizedTime <= 0) {
                console.warn(
                  `Invalid normalized time: ${normalizedTime} from raw time: ${rawTime}`
                );
                break;
              }

              console.log(
                `Normalized time: ${normalizedTime}, raw time was:`,
                rawTime
              );

              // Normalize numerical values for the candle
              const normalizeValue = (value: unknown): number => {
                if (typeof value === "number") {
                  return value;
                }
                if (typeof value === "string") {
                  return parseFloat(value);
                }
                return 0;
              };

              const candle: CandleData = {
                time: normalizedTime,
                open: normalizeValue(message.data.open),
                high: normalizeValue(message.data.high),
                low: normalizeValue(message.data.low),
                close: normalizeValue(message.data.close),
                volume: normalizeValue(message.data.volume),
              };

              console.log(
                "Processed candle data with time",
                candle.time,
                "and close",
                candle.close
              );

              set((state) => {
                // Convert timeframe from backend format to frontend format
                const symbol = message.symbol!.toLowerCase();
                let timeframe: string;

                // Map backend timeframe enum to frontend timeframe string
                switch (message.timeframe) {
                  case "ONE_MINUTE":
                    timeframe = "1m";
                    break;
                  case "FIVE_MINUTES":
                    timeframe = "5m";
                    break;
                  case "FIFTEEN_MINUTES":
                    timeframe = "15m";
                    break;
                  case "THIRTY_MINUTES":
                    timeframe = "30m";
                    break;
                  case "ONE_HOUR":
                    timeframe = "1h";
                    break;
                  case "FOUR_HOURS":
                    timeframe = "4h";
                    break;
                  case "ONE_DAY":
                    timeframe = "1d";
                    break;
                  default:
                    timeframe = message.timeframe!.toLowerCase();
                }

                // Get current candles for this symbol+timeframe
                const symbolCandles = state.candleData[symbol] || {};
                const timeframeCandles = symbolCandles[timeframe] || [];

                // Check if this candle already exists (same timestamp)
                const existingIndex = timeframeCandles.findIndex(
                  (c: CandleData) => {
                    const cTime = typeof c.time === "number" ? c.time : 0;
                    return cTime === normalizedTime;
                  }
                );

                let updatedCandles;
                if (existingIndex >= 0) {
                  // Update existing candle
                  updatedCandles = [...timeframeCandles];
                  updatedCandles[existingIndex] = candle;
                } else {
                  // Add new candle
                  updatedCandles = [...timeframeCandles, candle];

                  // Sort by time
                  updatedCandles.sort((a, b) => {
                    const timeA = typeof a.time === "number" ? a.time : 0;
                    const timeB = typeof b.time === "number" ? b.time : 0;
                    return timeA - timeB;
                  });

                  // Limit to maximum 300 candles to prevent memory issues
                  if (updatedCandles.length > 300) {
                    updatedCandles = updatedCandles.slice(
                      updatedCandles.length - 300
                    );
                  }
                }

                return {
                  candleData: {
                    ...state.candleData,
                    [symbol]: {
                      ...symbolCandles,
                      [timeframe]: updatedCandles,
                    },
                  },
                };
              });
            } catch (error) {
              console.error("Error processing OHLCV_UPDATE:", error);
            }
          }
          break;

        case "BALANCE_UPDATE":
          if (message.data) {
            console.log("WebSocket: Received balance update", message.data);
            set({ balance: message.data });
          }
          break;

        case "OPEN_ORDERS":
          if (Array.isArray(message.data)) {
            console.log("WebSocket: Received open orders", message.data);
            const orders: Record<string, OrderUpdate> = {};
            message.data.forEach((order) => {
              orders[order.id] = {
                orderId: order.id,
                symbol: order.symbolName,
                type: order.type,
                side: order.side,
                status: order.status,
                quantity: order.quantity,
                price: order.price,
                filledQuantity: order.filledQuantity || 0,
                averagePrice: order.averagePrice || order.price,
                timestamp: order.createdAt || Date.now(),
              };
            });
            set({ orders });
          }
          break;

        case "ORDER_UPDATE":
          if (message.data) {
            console.log("WebSocket: Received order update", message.data);
            const order: OrderUpdate = {
              orderId: message.data.id,
              symbol: message.data.symbolName,
              type: message.data.type,
              side: message.data.side,
              status: message.data.status,
              quantity: message.data.quantity,
              price: message.data.price,
              filledQuantity: message.data.filledQuantity || 0,
              averagePrice: message.data.averagePrice || message.data.price,
              timestamp: message.data.updatedAt || Date.now(),
            };
            set((state) => ({
              orders: {
                ...state.orders,
                [order.orderId]: order,
              },
            }));
          }
          break;

        case "ORDER_REMOVED":
          if (message.data?.orderId) {
            set((state) => ({
              orders: Object.fromEntries(
                Object.entries(state.orders).filter(
                  ([key]) => key !== message.data.orderId
                )
              ),
            }));
          }
          break;

        default:
          console.log("WebSocket: Unhandled message type:", message.type);
      }
    } catch (error) {
      console.error("WebSocket: Error handling message:", error);
      set({ lastError: "Failed to process message" });
    }
  };

  return {
    // Connection state
    connectionState: "disconnected",
    lastError: null,
    lastHeartbeat: 0,
    isAuthenticated: false,

    // Market data
    tickerData: {},
    candleData: {},

    // Subscriptions
    subscribedSymbols: new Set<string>(),
    subscribedCandles: new Map<string, Set<string>>(),
    activeSymbol: null,
    activeTimeframe: "1h",

    // Balance and Order data
    balance: null,
    orders: {},

    // Connection methods
    connect,
    disconnect,
    reconnect,

    // Subscription methods
    subscribeToSymbol: (symbol: string) => {
      // Add to subscription set
      set((state) => {
        const newSubscribedSymbols = new Set(state.subscribedSymbols);
        newSubscribedSymbols.add(symbol);
        return { subscribedSymbols: newSubscribedSymbols };
      });

      // Send subscription message if connected
      if (
        globalSocketInstance &&
        globalSocketInstance.readyState === WebSocket.OPEN
      ) {
        globalSocketInstance.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            symbol,
          })
        );
      } else {
        // If not connected, try to connect first
        connect();
      }
    },

    unsubscribeFromSymbol: (symbol: string) => {
      // Remove from subscription set
      set((state) => {
        const newSubscribedSymbols = new Set(state.subscribedSymbols);
        newSubscribedSymbols.delete(symbol);
        return { subscribedSymbols: newSubscribedSymbols };
      });

      // Send unsubscription message if connected
      if (
        globalSocketInstance &&
        globalSocketInstance.readyState === WebSocket.OPEN
      ) {
        globalSocketInstance.send(
          JSON.stringify({
            type: "UNSUBSCRIBE",
            symbol,
          })
        );
      }
    },

    subscribeToCandles: (symbol: string, timeframe: string) => {
      // Add to subscription set
      set((state) => {
        const newSubscribedCandles = new Map(state.subscribedCandles);
        const symbolTimeframes =
          newSubscribedCandles.get(symbol) || new Set<string>();
        symbolTimeframes.add(timeframe);
        newSubscribedCandles.set(symbol, symbolTimeframes);
        return { subscribedCandles: newSubscribedCandles };
      });

      // Send subscription message if connected
      if (
        globalSocketInstance &&
        globalSocketInstance.readyState === WebSocket.OPEN
      ) {
        globalSocketInstance.send(
          JSON.stringify({
            type: "SUBSCRIBE_CANDLES",
            symbol,
            timeframe,
          })
        );
      }
    },

    unsubscribeFromCandles: (symbol: string, timeframe: string) => {
      // Remove from subscription set
      set((state) => {
        const newSubscribedCandles = new Map(state.subscribedCandles);
        const symbolTimeframes = newSubscribedCandles.get(symbol);
        if (symbolTimeframes) {
          symbolTimeframes.delete(timeframe);
          if (symbolTimeframes.size === 0) {
            newSubscribedCandles.delete(symbol);
          } else {
            newSubscribedCandles.set(symbol, symbolTimeframes);
          }
        }
        return { subscribedCandles: newSubscribedCandles };
      });

      // Send unsubscription message if connected
      if (
        globalSocketInstance &&
        globalSocketInstance.readyState === WebSocket.OPEN
      ) {
        globalSocketInstance.send(
          JSON.stringify({
            type: "UNSUBSCRIBE_CANDLES",
            symbol,
            timeframe,
          })
        );
      }
    },

    setActiveSymbol: (symbol: string) => {
      const currentActiveSymbol = get().activeSymbol;

      // Only update if the symbol has changed
      if (currentActiveSymbol !== symbol) {
        console.log(
          `WebSocket: Setting active symbol from ${currentActiveSymbol} to ${symbol}`
        );
        set({ activeSymbol: symbol });

        // Ensure we're subscribed to this symbol
        if (
          globalSocketInstance &&
          globalSocketInstance.readyState === WebSocket.OPEN
        ) {
          // Add to subscription set if not already there
          if (!get().subscribedSymbols.has(symbol)) {
            set((state) => {
              const newSubscribedSymbols = new Set(state.subscribedSymbols);
              newSubscribedSymbols.add(symbol);
              return { subscribedSymbols: newSubscribedSymbols };
            });

            globalSocketInstance.send(
              JSON.stringify({
                type: "SUBSCRIBE",
                symbol,
              })
            );
          }
        }
      }
    },

    setActiveTimeframe: (timeframe: string) => {
      set({ activeTimeframe: timeframe });
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

    updateCandleData: (
      symbol: string,
      timeframe: string,
      data: CandleData[]
    ) => {
      set((state) => {
        const symbolCandles = state.candleData[symbol] || {};
        return {
          candleData: {
            ...state.candleData,
            [symbol]: {
              ...symbolCandles,
              [timeframe]: data,
            },
          },
        };
      });
    },

    appendCandleData: (
      symbol: string,
      timeframe: string,
      candle: CandleData
    ) => {
      set((state) => {
        const symbolCandles = state.candleData[symbol] || {};
        const timeframeCandles = symbolCandles[timeframe] || [];

        // Ensure candle time is a number in seconds
        let normalizedCandleTime: number;
        if (typeof candle.time === "number") {
          // Convert from milliseconds to seconds if needed
          normalizedCandleTime =
            candle.time > 10000000000
              ? Math.floor(candle.time / 1000)
              : candle.time;
        } else if (typeof candle.time === "string") {
          // Convert string date to seconds
          normalizedCandleTime = Math.floor(
            new Date(candle.time).getTime() / 1000
          );
        } else {
          console.warn("Invalid candle time format:", candle.time);
          return state; // Return unchanged state if time format is invalid
        }

        // Create a normalized candle with proper time format
        const normalizedCandle: CandleData = {
          ...candle,
          time: normalizedCandleTime,
        };

        // Check if this candle already exists (same timestamp)
        const existingIndex = timeframeCandles.findIndex((c) => {
          // Normalize existing candle time for comparison
          let existingTime: number;
          if (typeof c.time === "number") {
            existingTime =
              c.time > 10000000000 ? Math.floor(c.time / 1000) : c.time;
          } else if (typeof c.time === "string") {
            existingTime = Math.floor(new Date(c.time).getTime() / 1000);
          } else {
            existingTime = 0;
          }

          return existingTime === normalizedCandleTime;
        });

        let updatedCandles;
        if (existingIndex >= 0) {
          // Update existing candle
          updatedCandles = [...timeframeCandles];
          updatedCandles[existingIndex] = normalizedCandle;
        } else {
          // Add new candle
          updatedCandles = [...timeframeCandles, normalizedCandle].sort(
            (a, b) => {
              let timeA: number;
              if (typeof a.time === "number") {
                timeA = a.time;
              } else if (typeof a.time === "string") {
                timeA = Math.floor(new Date(a.time).getTime() / 1000);
              } else {
                timeA = 0;
              }

              let timeB: number;
              if (typeof b.time === "number") {
                timeB = b.time;
              } else if (typeof b.time === "string") {
                timeB = Math.floor(new Date(b.time).getTime() / 1000);
              } else {
                timeB = 0;
              }

              return timeA - timeB;
            }
          );
        }

        return {
          candleData: {
            ...state.candleData,
            [symbol]: {
              ...symbolCandles,
              [timeframe]: updatedCandles,
            },
          },
        };
      });
    },

    // Additional methods
    updateBalance: (balance: BalanceUpdate) => {
      set({ balance });
    },

    updateOrder: (order: OrderUpdate) => {
      set((state) => ({
        orders: {
          ...state.orders,
          [order.orderId]: order,
        },
      }));
    },

    removeOrder: (orderId: string) => {
      set((state) => ({
        orders: Object.fromEntries(
          Object.entries(state.orders).filter(([key]) => key !== orderId)
        ),
      }));
    },
  };
});

// Add React useEffect hook
import { useEffect } from "react";

// Helper function to use the WebSocket store in components
export function useWebSocket() {
  const {
    connect,
    disconnect,
    reconnect,
    connectionState,
    lastError,
    isAuthenticated,
    tickerData,
    candleData,
    balance,
    orders,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    subscribeToCandles,
    unsubscribeFromCandles,
    setActiveSymbol,
    setActiveTimeframe,
    activeSymbol,
    activeTimeframe,
    lastHeartbeat,
  } = useWebSocketStore();

  // Connect to WebSocket on component mount
  useEffect(() => {
    connect();
    return () => {
      // No need to disconnect on unmount as we want to keep the connection alive
      // disconnect();
    };
  }, [connect]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      const { isAuthenticated: authStoreAuthenticated } = state;

      // If auth state changes, reconnect the WebSocket
      if (connectionState === "connected") {
        console.log(
          `WebSocket: Auth state changed, reconnecting (authenticated: ${authStoreAuthenticated})`
        );
        reconnect();
      }
    });

    return unsubscribe;
  }, [connectionState, reconnect]);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    isConnecting: connectionState === "connecting",
    isDisconnected: connectionState === "disconnected",
    isAuthenticated,
    lastError,
    tickerData,
    candleData,
    balance,
    orders,
    connect,
    disconnect,
    reconnect,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    subscribeToCandles,
    unsubscribeFromCandles,
    setActiveSymbol,
    setActiveTimeframe,
    activeSymbol,
    activeTimeframe,
    lastHeartbeat,
  };
}
