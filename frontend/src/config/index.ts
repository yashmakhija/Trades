/**
 * Application Configuration
 *
 * This file contains centralized configuration settings for the application.
 */

// API base URL - defaults to localhost in development
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// WebSocket URL - derived from API base URL
export const WS_BASE_URL = (() => {
  try {
    // If API_BASE_URL is a full URL, convert http/https to ws/wss
    if (API_BASE_URL.startsWith("http")) {
      const url = new URL(API_BASE_URL);
      const protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${url.host}/ws`;
    }

    // If it's just a host or path, assume ws://
    return `ws://${API_BASE_URL.replace(/^\//, "")}/ws`;
  } catch (e) {
    // Fallback to default WebSocket URL
    return "ws://localhost:3001/ws";
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
