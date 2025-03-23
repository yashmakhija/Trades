import { useEffect, useState, useCallback } from "react";
import { useWebSocketStore } from "@/services/websocket";

interface WebSocketConfig {
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Enhanced custom WebSocket hook for component-specific WebSocket handling
 * Uses the singleton WebSocketStore for the actual connection
 */
export function useCustomWebSocket(config: WebSocketConfig) {
  const store = useWebSocketStore();
  const [lastEvent, setLastEvent] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(
    store.connectionState === "connected"
  );

  useEffect(() => {
    // Ensure we have an active connection when component mounts
    if (store.connectionState !== "connected") {
      store.connect();
    }

    // Call onOpen if we're already connected
    if (store.connectionState === "connected" && config.onOpen) {
      config.onOpen();
    }

    // Track connection state changes
    const handleConnectionChange = () => {
      const newConnected = store.connectionState === "connected";
      setIsConnected(newConnected);

      if (newConnected && config.onOpen) {
        config.onOpen();
      } else if (!newConnected && config.onClose) {
        config.onClose();
      }
    };

    // Set up an interval to check connection state
    const connectionCheckInterval = setInterval(() => {
      const newConnected = store.connectionState === "connected";
      if (isConnected !== newConnected) {
        handleConnectionChange();
      }

      // If we're not connected, try to reconnect
      if (
        store.connectionState !== "connected" &&
        store.connectionState !== "connecting"
      ) {
        store.connect();
      }
    }, 5000);

    return () => {
      clearInterval(connectionCheckInterval);
      // We don't actually close the connection on unmount
      // to maintain persistence across the app
    };
  }, [config, store]);

  // Subscribe to WebSocket messages using the store's connection state
  useEffect(() => {
    // Create a global event listener for WebSocket messages
    const handleMessage = (event: Event) => {
      // MessageEvent type is expected here
      const messageEvent = event as MessageEvent;
      setLastEvent(messageEvent);
      config.onMessage?.(messageEvent);
    };

    // Add a global event listener
    window.addEventListener("ws-message", handleMessage);

    return () => {
      window.removeEventListener("ws-message", handleMessage);
    };
  }, [config]);

  // Manual reconnect method
  const reconnect = useCallback(() => {
    store.reconnect();
  }, [store]);

  return {
    isConnected,
    lastEvent,
    reconnect,
    connectionState: store.connectionState,
    // No need to return the WebSocket instance as we're using the singleton
  };
}

export { useWebSocketStore as useWebSocket };
