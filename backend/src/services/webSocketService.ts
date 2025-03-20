/**
 * WebSocket Service
 *
 * Manages WebSocket connections with clients, handling:
 * - Client connection management
 * - Symbol subscription system
 * - Real-time data broadcasting
 * - User authentication for private channels
 * - Order and balance updates broadcasting
 * - Candle data updates
 */
import { Server } from "http";
import WebSocket, { WebSocketServer } from "ws";
import {
  getAllTickerData,
  getLatestTickerData,
  addSymbolToTracking,
  removeSymbolFromTracking,
} from "./binanceService";
import { prisma } from "../lib/prisma";
import { orderManager } from "./orderManager";
import { candleService } from "./candleService";
import { Timeframe } from "@prisma/client";
import { balanceManager } from "./balanceManager";
import jwt from "jsonwebtoken";
import { config } from "../config";

// WebSocket client with authentication and connection state
interface WSClient {
  ws: WebSocket;
  userId?: string;
  isAlive: boolean;
  subscribedSymbols: Set<string>;
  isAuthenticated: boolean;
}

// Singleton instance
class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, WSClient>();
  private pingInterval: NodeJS.Timer | null = null;

  /**
   * Initialize the WebSocket server
   * @param server HTTP server instance
   */
  public initWebSocketServer(server: Server): void {
    if (this.wss) {
      console.warn("WebSocket server already initialized");
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      clientTracking: true,
      perMessageDeflate: false,
    });

    candleService.setWebSocketServer(this.wss);

    this.wss.on("connection", this.handleConnection.bind(this));

    // Health check interval
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;

      this.clients.forEach((client, ws) => {
        if (!client.isAlive) {
          console.log(
            `Terminating inactive connection for user: ${
              client.userId || "anonymous"
            }`
          );
          this.clients.delete(ws);
          return ws.terminate();
        }
        client.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on("close", () => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      console.log("WebSocket server closed");
    });

    console.log("WebSocket server initialized");
  }

  /**
   * Handle new WebSocket connections
   */
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    // Initialize client state
    const client: WSClient = {
      ws,
      isAlive: true,
      subscribedSymbols: new Set(),
      isAuthenticated: false,
    };
    this.clients.set(ws, client);

    try {
      // Parse URL and get token if provided
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token = url.searchParams.get("token");

      console.log("WebSocket connection request URL:", request.url);
      console.log(
        "Parsed token from URL:",
        token ? "***token-exists***" : "null"
      );

      // Send initial market data to all clients (authenticated or not)
      const allTickerData = getAllTickerData();
      ws.send(JSON.stringify({ type: "INITIAL_DATA", data: allTickerData }));

      // If token is provided, verify it
      if (token) {
        try {
          const userId = await this.verifyToken(token);

          if (userId) {
            client.userId = userId;
            client.isAuthenticated = true;
            console.log(`Client authenticated with userId: ${userId}`);

            // Send user-specific data
            try {
              console.log(`Fetching balance for user ${userId}`);
              const balance = await balanceManager.getUserBalance(userId);

              if (balance) {
                console.log(`Balance found for user ${userId}:`, balance.total);
                ws.send(
                  JSON.stringify({ type: "BALANCE_UPDATE", data: balance })
                );
              } else {
                console.log(
                  `No balance data found for user ${userId}, initializing...`
                );
                // Try to initialize the user balance
                await this.initializeUserBalance(userId);

                // Try to get the balance again
                const retryBalance = await balanceManager.getUserBalance(
                  userId
                );
                if (retryBalance) {
                  console.log(`Balance initialized for user ${userId}`);
                  ws.send(
                    JSON.stringify({
                      type: "BALANCE_UPDATE",
                      data: retryBalance,
                    })
                  );
                } else {
                  console.log(
                    `Failed to initialize balance for user ${userId}`
                  );
                }
              }

              // Send open orders
              const openOrders = await orderManager.getUserOpenOrders(userId);
              if (openOrders.length > 0) {
                ws.send(
                  JSON.stringify({ type: "OPEN_ORDERS", data: openOrders })
                );
              }

              // Send authentication success message
              ws.send(
                JSON.stringify({
                  type: "AUTHENTICATION_SUCCESS",
                  userId: userId,
                })
              );

              // Send connection success for authenticated users
              ws.send(
                JSON.stringify({
                  type: "CONNECTION_SUCCESS",
                  message: "Authenticated connection established",
                  authenticated: true,
                })
              );
            } catch (error) {
              console.error(`Error sending user data for ${userId}:`, error);
              ws.send(
                JSON.stringify({
                  type: "AUTH_ERROR",
                  error: "Error retrieving user data",
                })
              );
            }
          } else {
            console.warn(
              "Invalid token provided, continuing as anonymous user"
            );
            ws.send(
              JSON.stringify({
                type: "AUTH_ERROR",
                error: "Invalid token provided",
              })
            );

            // Send connection success for anonymous users
            ws.send(
              JSON.stringify({
                type: "CONNECTION_SUCCESS",
                message: "Anonymous connection established",
                authenticated: false,
              })
            );
          }
        } catch (error) {
          console.warn("Token verification error:", error);
          ws.send(
            JSON.stringify({
              type: "AUTH_ERROR",
              error: "Token verification failed",
            })
          );

          // Send connection success for anonymous users
          ws.send(
            JSON.stringify({
              type: "CONNECTION_SUCCESS",
              message: "Anonymous connection established",
              authenticated: false,
            })
          );
        }
      } else {
        console.log("Anonymous connection established");
        // Send connection success for anonymous users
        ws.send(
          JSON.stringify({
            type: "CONNECTION_SUCCESS",
            message: "Anonymous connection established",
            authenticated: false,
          })
        );
      }

      // Setup event handlers
      ws.on("pong", () => {
        const client = this.clients.get(ws);
        if (client) {
          client.isAlive = true;
        }
      });

      ws.on("message", async (message) => {
        try {
          await this.handleClientMessage(ws, message);
        } catch (error) {
          console.error("Error processing message:", error);
          ws.send(
            JSON.stringify({
              type: "ERROR",
              error: "Failed to process message",
            })
          );
        }
      });

      ws.on("close", () => {
        const clientId = client.userId || "anonymous";
        console.log(`Client disconnected: ${clientId}`);

        // Cleanup symbol tracking
        client.subscribedSymbols.forEach((symbol) => {
          let stillInUse = false;
          this.clients.forEach((otherClient) => {
            if (
              otherClient !== client &&
              otherClient.subscribedSymbols.has(symbol)
            ) {
              stillInUse = true;
            }
          });
          if (!stillInUse) {
            removeSymbolFromTracking(symbol);
          }
        });

        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error(
          `WebSocket error for client ${client.userId || "anonymous"}:`,
          error
        );
      });
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1011, "Internal server error");
    }
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<string | null> {
    try {
      // Use the JWT_SECRET from config instead of directly from process.env
      const secret = config.jwtSecret;

      if (!token || !secret) {
        console.warn("Missing token or JWT secret");
        return null;
      }

      const decoded = jwt.verify(token, secret) as { userId: string };

      if (!decoded || !decoded.userId) {
        console.warn("Token decoded but userId missing");
        return null;
      }

      // Log the userId for debugging
      console.log("Extracted userId from token:", decoded.userId);

      // Validate that userId is a valid UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decoded.userId)) {
        console.warn(`Invalid userId format: ${decoded.userId}`);
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true },
      });

      if (!user) {
        console.warn(`User with ID ${decoded.userId} not found`);
        return null;
      }

      return user.id;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.warn(`JWT verification error: ${error.message}`);
      } else if (error instanceof jwt.TokenExpiredError) {
        console.warn("Token expired");
      } else {
        console.error("Unknown token verification error:", error);
      }
      return null;
    }
  }

  /**
   * Handle client messages
   */
  private async handleClientMessage(
    ws: WebSocket,
    message: WebSocket.Data
  ): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const data = JSON.parse(message.toString());
      const symbol = (data.symbol || "").toLowerCase();

      switch (data.type) {
        case "SUBSCRIBE":
          if (symbol) {
            client.subscribedSymbols.add(symbol);
            addSymbolToTracking(symbol);
            console.log(`Client subscribed to ${symbol}`);

            const tickerData = getLatestTickerData(symbol);
            if (tickerData) {
              ws.send(
                JSON.stringify({
                  type: "TICKER_UPDATE",
                  symbol,
                  data: {
                    ...tickerData,
                    displayPrice: tickerData.price / 100,
                  },
                })
              );

              // Update balance manager with current price if client has positions
              if (client.userId) {
                balanceManager.updateSymbolPrice(symbol, tickerData.price);
              }
            }
          }
          break;

        case "UNSUBSCRIBE":
          if (symbol) {
            client.subscribedSymbols.delete(symbol);
            // Check if any other client is still subscribed
            let stillInUse = false;
            this.clients.forEach((otherClient) => {
              if (
                otherClient !== client &&
                otherClient.subscribedSymbols.has(symbol)
              ) {
                stillInUse = true;
              }
            });
            if (!stillInUse) {
              removeSymbolFromTracking(symbol);
            }
            console.log(`Client unsubscribed from ${symbol}`);
          }
          break;

        case "SUBSCRIBE_CANDLES":
          if (symbol) {
            const timeframe = data.timeframe || "1m";
            await this.handleCandleSubscription(client, symbol, timeframe);
          }
          break;

        case "PLACE_ORDER":
          if (!client.isAuthenticated || !client.userId) {
            ws.send(
              JSON.stringify({
                type: "AUTH_ERROR",
                error: "Authentication required for placing orders",
              })
            );
            return;
          }

          if (data.orderData) {
            try {
              const order = await orderManager.addOrder({
                userId: client.userId,
                ...data.orderData,
              });
              this.broadcastOrderUpdate(client.userId, order);
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: "ORDER_ERROR",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to place order",
                })
              );
            }
          }
          break;

        case "CANCEL_ORDER":
          if (!client.isAuthenticated || !client.userId) {
            ws.send(
              JSON.stringify({
                type: "AUTH_ERROR",
                error: "Authentication required for canceling orders",
              })
            );
            return;
          }

          if (data.orderId) {
            try {
              const order = await orderManager.cancelOrder(
                client.userId,
                data.orderId
              );
              this.broadcastOrderUpdate(client.userId, order);
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: "ORDER_ERROR",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to cancel order",
                })
              );
            }
          }
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error("Error handling client message:", error);
    }
  }

  /**
   * Handle candle subscription
   */
  private async handleCandleSubscription(
    client: WSClient,
    symbol: string,
    timeframe: string
  ): Promise<void> {
    try {
      if (!symbol) {
        console.warn("Attempted to subscribe to candles with no symbol");
        return;
      }

      const timeframeEnum = this.mapTimeframeToEnum(timeframe);
      client.subscribedSymbols.add(symbol);
      addSymbolToTracking(symbol);

      console.log(
        `Client ${
          client.userId || "anonymous"
        } subscribed to ${symbol} candles with timeframe ${timeframe}`
      );

      const candles = await candleService.getCandles(symbol, timeframeEnum);
      if (candles?.length) {
        client.ws.send(
          JSON.stringify({
            type: "CANDLE_HISTORY",
            symbol,
            timeframe,
            data: candles,
          })
        );

        // Update balance manager with latest candle price if client has positions
        if (client.userId && client.isAuthenticated) {
          const latestCandle = candles[candles.length - 1];
          balanceManager.updateSymbolPrice(symbol, latestCandle.close);
        }
      } else {
        console.log(
          `No candle data available for ${symbol} with timeframe ${timeframe}`
        );
      }
    } catch (error) {
      console.error(`Error subscribing to candles for ${symbol}:`, error);
    }
  }

  /**
   * Map timeframe string to enum
   */
  private mapTimeframeToEnum(timeframe: string): Timeframe {
    switch (timeframe) {
      case "1m":
        return Timeframe.ONE_MINUTE;
      case "5m":
        return Timeframe.FIVE_MINUTES;
      case "15m":
        return Timeframe.FIFTEEN_MINUTES;
      case "30m":
        return Timeframe.THIRTY_MINUTES;
      case "1h":
        return Timeframe.ONE_HOUR;
      case "4h":
        return Timeframe.FOUR_HOURS;
      case "1d":
        return Timeframe.ONE_DAY;
      default:
        return Timeframe.ONE_MINUTE;
    }
  }

  /**
   * Broadcast to specific user
   */
  public broadcastToUser(userId: string, type: string, data: any): void {
    if (!this.wss) {
      console.warn("WebSocket server not initialized");
      return;
    }

    if (!userId) {
      console.warn(`Attempted to broadcast ${type} with no userId`);
      return;
    }

    const message = JSON.stringify({ type, data });
    let sent = false;

    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sent = true;
      }
    });

    if (!sent) {
      console.log(
        `No active connections found for user ${userId} to send ${type}`
      );
    }
  }

  /**
   * Broadcast balance update
   */
  public broadcastBalanceUpdate(userId: string, balanceData: any): void {
    this.broadcastToUser(userId, "BALANCE_UPDATE", balanceData);
  }

  /**
   * Broadcast trade analytics
   */
  public broadcastTradeAnalytics(userId: string, analytics: any): void {
    this.broadcastToUser(userId, "TRADE_ANALYTICS_UPDATE", analytics);
  }

  /**
   * Broadcast order update
   */
  public broadcastOrderUpdate(userId: string, orderData: any): void {
    if (!userId) {
      console.warn("Attempted to broadcast order update with no userId");
      return;
    }

    this.broadcastToUser(userId, "ORDER_UPDATE", orderData);

    // Also update balance since order status change affects it
    if (orderData.status === "FILLED" || orderData.status === "CANCELED") {
      balanceManager
        .getUserBalance(userId)
        .then((balance) => {
          if (balance) {
            this.broadcastBalanceUpdate(userId, balance);
          } else {
            console.warn(
              `No balance found for user ${userId} when updating order status`
            );
          }
        })
        .catch((error) => {
          console.error(`Error getting balance for user ${userId}:`, error);
        });
    }
  }

  /**
   * Broadcast OHLCV update
   */
  public broadcastOHLCVUpdate(
    symbol: string,
    timeframe: string,
    data: any
  ): void {
    if (!this.wss) return;

    // Format data for frontend consumption
    // Make sure we're sending properly formatted data that the chart can understand
    const formattedData = {
      ...data,
      // Ensure price fields are sent as numbers, not strings
      open: typeof data.open === "number" ? data.open : parseFloat(data.open),
      high: typeof data.high === "number" ? data.high : parseFloat(data.high),
      low: typeof data.low === "number" ? data.low : parseFloat(data.low),
      close:
        typeof data.close === "number" ? data.close : parseFloat(data.close),
      volume:
        typeof data.volume === "number" ? data.volume : parseFloat(data.volume),
      // Make sure time is in the expected format for the frontend
      time:
        typeof data.time === "number"
          ? data.time
          : new Date(data.time).getTime(),
    };

    // Log sample data periodically for debugging
    if (Math.random() < 0.01) {
      // Log roughly 1% of updates to avoid log spam
      console.log(
        `Sample OHLCV update for ${symbol}/${timeframe}:`,
        formattedData
      );
    }

    const message = JSON.stringify({
      type: "OHLCV_UPDATE",
      symbol,
      timeframe,
      data: formattedData,
    });

    this.clients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedSymbols.size === 0 ||
          client.subscribedSymbols.has(symbol))
      ) {
        client.ws.send(message);

        // Update balance manager with new price if client has positions
        if (client.userId && client.isAuthenticated) {
          balanceManager.updateSymbolPrice(symbol, formattedData.close);
        }
      }
    });
  }

  /**
   * Broadcast ticker update
   */
  public broadcastTickerUpdate(symbol: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: "TICKER_UPDATE",
      symbol,
      data,
    });

    this.clients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedSymbols.size === 0 ||
          client.subscribedSymbols.has(symbol))
      ) {
        client.ws.send(message);

        // Update balance manager with new price if client has positions
        if (client.userId && client.isAuthenticated) {
          balanceManager.updateSymbolPrice(symbol, data.price);
        }
      }
    });
  }

  /**
   * Broadcast raw data
   */
  public broadcastRawData(symbol: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: "RAW_DATA",
      symbol,
      data,
    });

    this.clients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedSymbols.size === 0 ||
          client.subscribedSymbols.has(symbol))
      ) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Initialize user balance if it doesn't exist
   */
  private async initializeUserBalance(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        console.error("Cannot initialize balance for undefined userId");
        return false;
      }

      console.log(`Manually initializing balance for user ${userId}`);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, usdcBalance: true },
      });

      if (!user) {
        console.error(`User not found for ID: ${userId}`);
        return false;
      }

      // Create a default balance entry
      await prisma.user.update({
        where: { id: userId },
        data: {
          usdcBalance: user.usdcBalance || 1000000, // Default 10,000 USD (in cents)
        },
      });

      console.log(`Balance initialized for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error initializing balance for user ${userId}:`, error);
      return false;
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Export functions
export const initWebSocketServer =
  webSocketService.initWebSocketServer.bind(webSocketService);
export const broadcastToUser =
  webSocketService.broadcastToUser.bind(webSocketService);
export const broadcastBalanceUpdate =
  webSocketService.broadcastBalanceUpdate.bind(webSocketService);
export const broadcastTradeAnalytics =
  webSocketService.broadcastTradeAnalytics.bind(webSocketService);
export const broadcastOrderUpdate =
  webSocketService.broadcastOrderUpdate.bind(webSocketService);
export const broadcastOHLCVUpdate =
  webSocketService.broadcastOHLCVUpdate.bind(webSocketService);
export const broadcastTickerUpdate =
  webSocketService.broadcastTickerUpdate.bind(webSocketService);
export const broadcastRawData =
  webSocketService.broadcastRawData.bind(webSocketService);
