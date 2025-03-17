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

// Create WebSocket store
export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  // WebSocket instance
  let socketInstance: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  let isReconnecting = false;

  // Handle WebSocket messages
  const handleMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket: Received message:", message.type);

      // Update last heartbeat time
      set({ lastHeartbeat: Date.now() });

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

            // Handle different types of Binance WebSocket messages
            if (rawData.e === "kline" && rawData.k) {
              const kline = rawData.k;

              // Update ticker data with latest price
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
                      // Convert price from string to number and then divide by 100 if it's from the backend
                      // If it's directly from Binance, it's already a floating-point number as a string
                      price: parseFloat(kline.c),
                      volume: parseFloat(kline.v),
                      timestamp: rawData.E,
                    },
                  },
                };
              });

              // Create candle data from kline
              const candle: CandleData = {
                time: Math.floor(kline.t / 1000), // Convert to seconds for charts
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                volume: parseFloat(kline.v),
              };

              // Update candle data for active timeframe
              const activeTimeframe = get().activeTimeframe;
              if (kline.i.toLowerCase() === activeTimeframe) {
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
              // Update ticker data
              set((state) => ({
                tickerData: {
                  ...state.tickerData,
                  [symbol]: {
                    symbol,
                    // Convert price from string to number
                    // If it's from Binance, it's already a floating-point number as a string
                    price: parseFloat(rawData.c),
                    priceChangePercent: parseFloat(rawData.P),
                    volume: parseFloat(rawData.v),
                    timestamp: rawData.E,
                  },
                },
              }));
            } else if (rawData.e === "trade") {
              // Update ticker with latest trade price
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
                      // Convert price from string to number
                      // If it's from Binance, it's already a floating-point number as a string
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
            set((state) => ({
              tickerData: {
                ...state.tickerData,
                [message.symbol!]: {
                  symbol: message.symbol!,
                  // Convert price from integer to floating-point (divide by 100)
                  price:
                    typeof message.data.price === "number"
                      ? message.data.price / 100
                      : message.data.price,
                  priceChangePercent: message.data.priceChangePercent || 0,
                  volume: message.data.volume || 0,
                  timestamp: message.data.timestamp || Date.now(),
                },
              },
            }));
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
            // Ensure time is in seconds for lightweight-charts
            let normalizedTime: number;
            const rawTime = message.data.time;

            // Convert time to a proper timestamp number in seconds
            if (typeof rawTime === "number") {
              // Convert milliseconds to seconds if needed
              normalizedTime =
                rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;
            } else if (typeof rawTime === "string") {
              // Convert string date to seconds
              normalizedTime = Math.floor(new Date(rawTime).getTime() / 1000);
            } else {
              console.warn("Invalid candle time format:", rawTime);
              break; // Skip this update if time format is invalid
            }

            const candle: CandleData = {
              time: normalizedTime,
              open: message.data.open,
              high: message.data.high,
              low: message.data.low,
              close: message.data.close,
              volume: message.data.volume,
            };

            set((state) => {
              const symbol = message.symbol!.toLowerCase();
              const timeframe = message.timeframe!;

              // First, update the 1m candle data
              const symbolCandles = state.candleData[symbol] || {};
              const timeframeCandles = symbolCandles[timeframe] || [];

              // Check if this candle already exists (same timestamp)
              const existingIndex = timeframeCandles.findIndex((c) => {
                let existingTime: number;
                if (typeof c.time === "number") {
                  existingTime =
                    c.time > 10000000000 ? Math.floor(c.time / 1000) : c.time;
                } else if (typeof c.time === "string") {
                  existingTime = Math.floor(new Date(c.time).getTime() / 1000);
                } else {
                  existingTime = 0;
                }
                return existingTime === normalizedTime;
              });

              let updatedCandles;
              if (existingIndex >= 0) {
                // Update existing candle
                updatedCandles = [...timeframeCandles];
                updatedCandles[existingIndex] = candle;
              } else {
                // Add new candle
                updatedCandles = [...timeframeCandles, candle].sort((a, b) => {
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
                });
              }

              // Create a new state object with updated 1m candles
              const newCandleData = {
                ...state.candleData,
                [symbol]: {
                  ...symbolCandles,
                  [timeframe]: updatedCandles,
                },
              };

              // Now update all other timeframes that are subscribed for this symbol
              const subscribedTimeframes = state.subscribedCandles.get(symbol);
              if (subscribedTimeframes && timeframe === "1m") {
                // Only aggregate from 1m candles
                subscribedTimeframes.forEach((tf) => {
                  if (tf !== "1m") {
                    const existingTfCandles =
                      (newCandleData[symbol] && newCandleData[symbol][tf]) ||
                      [];
                    const { updatedCandles: aggregatedCandles } =
                      aggregateCandle(candle, tf, existingTfCandles);

                    // Update the timeframe data
                    if (!newCandleData[symbol]) {
                      newCandleData[symbol] = {};
                    }
                    newCandleData[symbol][tf] = aggregatedCandles;
                  }
                });
              }

              return { candleData: newCandleData };
            });
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

  // Setup WebSocket connection
  const setupWebSocket = () => {
    if (isReconnecting) {
      console.log("WebSocket: Already reconnecting, skipping setup");
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Set connection state to connecting
    set({ connectionState: "connecting" });
    console.log("WebSocket: Connect method called");

    // Check if we already have a connection
    if (
      socketInstance &&
      (socketInstance.readyState === WebSocket.CONNECTING ||
        socketInstance.readyState === WebSocket.OPEN)
    ) {
      console.log(
        "WebSocket: Connection already exists, not creating a new one"
      );
      return;
    }

    try {
      // Get the current token from auth store
      const { token } = useAuthStore.getState();

      // Create WebSocket URL with token if available
      let wsUrl = WS_BASE_URL;
      if (token) {
        wsUrl += `?token=${token}`;
        console.log("WebSocket: Connecting with authentication token");
      } else {
        console.log("WebSocket: Connecting without authentication");
      }

      socketInstance = new WebSocket(wsUrl);

      socketInstance.onopen = () => {
        console.log("WebSocket: Connection established");
        set({
          connectionState: "connected",
          lastError: null,
          lastHeartbeat: Date.now(),
        });
        reconnectAttempts = 0;
        isReconnecting = false;

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

        // Set up heartbeat interval
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(() => {
          if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
            // Check if we haven't received a message in a while
            const lastHeartbeat = get().lastHeartbeat;
            const now = Date.now();

            if (now - lastHeartbeat > WS_HEARTBEAT_INTERVAL_MS * 2) {
              console.log(
                "WebSocket: No messages received recently, reconnecting..."
              );
              reconnect();
              return;
            }

            // Send ping to keep connection alive
            socketInstance.send(JSON.stringify({ type: "PING" }));
          } else {
            console.log(
              "WebSocket: Connection not open during heartbeat check, reconnecting..."
            );
            reconnect();
          }
        }, WS_HEARTBEAT_INTERVAL_MS);
      };

      socketInstance.onmessage = handleMessage;

      socketInstance.onclose = (event) => {
        console.log(`WebSocket: Connection closed (${event.code})`);
        set({
          connectionState: "disconnected",
          isAuthenticated: false,
        });

        // Clear heartbeat interval
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        // Attempt to reconnect if not intentionally closed
        if (!isReconnecting && event.code !== 1000) {
          isReconnecting = true;

          if (reconnectAttempts < WS_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay =
              WS_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
            console.log(
              `WebSocket: Reconnecting after close... Attempt ${reconnectAttempts} in ${delay}ms`
            );
            reconnectTimeout = setTimeout(setupWebSocket, delay);
          } else {
            console.log("WebSocket: Max reconnect attempts reached, giving up");
            set({
              lastError: "Failed to reconnect after multiple attempts",
            });
            isReconnecting = false;
          }
        }
      };

      socketInstance.onerror = (error) => {
        console.error("WebSocket: Connection error", error);
        set({
          lastError: "Connection error",
          connectionState: "disconnected",
          isAuthenticated: false,
        });

        // Clear heartbeat interval
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        // Attempt to reconnect
        if (!isReconnecting && reconnectAttempts < WS_RECONNECT_ATTEMPTS) {
          isReconnecting = true;
          reconnectAttempts++;
          const delay =
            WS_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
          console.log(
            `WebSocket: Reconnecting after error... Attempt ${reconnectAttempts} in ${delay}ms`
          );
          reconnectTimeout = setTimeout(setupWebSocket, delay);
        } else if (reconnectAttempts >= WS_RECONNECT_ATTEMPTS) {
          console.log("WebSocket: Max reconnect attempts reached, giving up");
          set({
            lastError: "Failed to reconnect after multiple attempts",
          });
          isReconnecting = false;
        }
      };
    } catch (error) {
      console.error("WebSocket: Error setting up connection", error);
      set({
        lastError: "Failed to set up connection",
        connectionState: "disconnected",
        isAuthenticated: false,
      });
    }
  };

  // Reconnect to WebSocket with current auth token
  const reconnect = () => {
    // Close existing connection if it's open
    if (socketInstance) {
      if (socketInstance.readyState === WebSocket.OPEN) {
        socketInstance.close();
      }
      socketInstance = null;
    }

    // Clear any existing intervals or timeouts
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Wait a moment to ensure the connection is closed
    setTimeout(() => {
      isReconnecting = true;
      console.log("WebSocket: Reconnecting with new connection");

      // Set up a new connection
      set({ connectionState: "connecting" });
      setupWebSocket();
    }, 500);
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (socketInstance) {
      socketInstance.close();
      socketInstance = null;
    }

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    set({
      connectionState: "disconnected",
      isAuthenticated: false,
    });
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
    connect: setupWebSocket,
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
      if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
        socketInstance.send(
          JSON.stringify({
            type: "SUBSCRIBE",
            symbol,
          })
        );
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
      if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
        socketInstance.send(
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
      if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
        socketInstance.send(
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
      if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
        socketInstance.send(
          JSON.stringify({
            type: "UNSUBSCRIBE_CANDLES",
            symbol,
            timeframe,
          })
        );
      }
    },

    setActiveSymbol: (symbol: string) => {
      set({ activeSymbol: symbol });
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
  };
}

// Add a helper function to aggregate candles
function aggregateCandle(
  candle: CandleData,
  timeframe: string,
  existingCandles: CandleData[]
): { updatedCandles: CandleData[]; isNewCandle: boolean } {
  // Skip if candle time is invalid
  if (typeof candle.time !== "number") {
    console.warn("Invalid candle time format for aggregation:", candle.time);
    return { updatedCandles: existingCandles, isNewCandle: false };
  }

  // Determine interval in minutes
  let intervalMinutes = 1;
  switch (timeframe) {
    case "5m":
      intervalMinutes = 5;
      break;
    case "15m":
      intervalMinutes = 15;
      break;
    case "30m":
      intervalMinutes = 30;
      break;
    case "1h":
      intervalMinutes = 60;
      break;
    case "4h":
      intervalMinutes = 240;
      break;
    case "1d":
      intervalMinutes = 1440;
      break;
    case "1w":
      intervalMinutes = 10080;
      break;
    default:
      return { updatedCandles: existingCandles, isNewCandle: false }; // Skip aggregation for 1m
  }

  // Calculate the interval start time
  const candleTimeMs = candle.time * 1000; // Convert seconds to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalStart = Math.floor(candleTimeMs / intervalMs) * intervalMs;
  const intervalStartSec = Math.floor(intervalStart / 1000);

  // Find if we already have a candle for this interval
  const existingIndex = existingCandles.findIndex(
    (c) => typeof c.time === "number" && Math.floor(c.time) === intervalStartSec
  );

  // Clone the candles array to avoid mutating the original
  const updatedCandles = [...existingCandles];
  let isNewCandle = false;

  if (existingIndex >= 0) {
    // Update existing candle
    const existingCandle = updatedCandles[existingIndex];
    updatedCandles[existingIndex] = {
      time: intervalStartSec,
      open: existingCandle.open, // Keep original open
      high: Math.max(existingCandle.high, candle.high),
      low: Math.min(existingCandle.low, candle.low),
      close: candle.close, // Update close to latest
      volume: existingCandle.volume + candle.volume, // Accumulate volume
    };
  } else {
    // Create new candle for this interval
    updatedCandles.push({
      time: intervalStartSec,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    });
    isNewCandle = true;

    // Sort candles by time
    updatedCandles.sort((a, b) => {
      const timeA = typeof a.time === "number" ? a.time : 0;
      const timeB = typeof b.time === "number" ? b.time : 0;
      return timeA - timeB;
    });
  }

  return { updatedCandles, isNewCandle };
}
