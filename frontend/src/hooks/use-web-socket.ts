import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/use-auth-store";
import { useWebSocket as useWebSocketStore } from "@/services/websocket";

interface WebSocketConfig {
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useCustomWebSocket(config: WebSocketConfig) {
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Authenticate the WebSocket connection
      ws.send(
        JSON.stringify({
          type: "AUTHENTICATE",
          userId: user.id,
        })
      );

      config.onOpen?.();
    };

    ws.onmessage = (event) => {
      config.onMessage?.(event);
    };

    ws.onclose = () => {
      config.onClose?.();
    };

    ws.onerror = (error) => {
      config.onError?.(error);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [user?.id, config]);

  return wsRef.current;
}

export { useWebSocketStore as useWebSocket };
