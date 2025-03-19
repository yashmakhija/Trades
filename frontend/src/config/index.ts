/**
 * Application Configuration
 *
 * This file contains centralized configuration settings for the application.
 */

// API base URL - Use environment variable or determine based on hostname
export const API_BASE_URL = (() => {
  // If NEXT_PUBLIC_API_URL is set, use it
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In browser environment, determine API URL based on current hostname
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost") {
      return "http://localhost:3001";
    } else if (window.location.hostname === "trade.classicoder.com") {
      return "https://trade.classicoder.com";
    }
  }

  // Default fallback
  return "http://localhost:3001";
})();

// WebSocket URL - derived from API base URL
export const WS_BASE_URL = (() => {
  try {
    // If API_BASE_URL is a full URL, convert http/https to ws/wss
    if (API_BASE_URL.startsWith("http")) {
      const url = new URL(API_BASE_URL);
      const protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${url.host}/ws`;
      console.log(
        `Configured WebSocket URL: ${wsUrl} (derived from API_BASE_URL: ${API_BASE_URL})`
      );
      return wsUrl;
    }

    // If it's just a host or path, assume ws://
    const wsUrl = `ws://${API_BASE_URL.replace(/^\//, "")}/ws`;
    console.log(
      `Configured WebSocket URL: ${wsUrl} (derived from API_BASE_URL: ${API_BASE_URL})`
    );
    return wsUrl;
  } catch (e) {
    // Fallback to default WebSocket URL
    const defaultWsUrl = "ws://localhost:3001/ws";
    console.log(
      `Using default WebSocket URL: ${defaultWsUrl} (error deriving from API_BASE_URL: ${API_BASE_URL})`,
      e
    );
    return defaultWsUrl;
  }
})();

// Default trading symbols
export const DEFAULT_SYMBOLS = [
  "btcusdt",
  "ethusdt",
  "bnbusdt",
  "solusdt",
  "adausdt",
];

// WebSocket reconnection settings
export const WS_RECONNECT_ATTEMPTS = 5;
export const WS_RECONNECT_DELAY_MS = 3000;
export const WS_HEARTBEAT_INTERVAL_MS = 30000;

// Chart settings
export const DEFAULT_CHART_HEIGHT = 500;
export const DEFAULT_TIMEFRAME = "1h";

// Order settings
export const DEFAULT_ORDER_QUANTITY = "0.01";

// Polling intervals
export const ORDER_POLLING_INTERVAL_MS = 10000; // 10 seconds
