import { useEffect, useState } from "react";
import { useWebSocketStore } from "@/services/websocket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const connectionState = useWebSocketStore((state) => state.connectionState);
  const connect = useWebSocketStore((state) => state.connect);
  const [showReconnectButton, setShowReconnectButton] = useState(false);

  // Handle reconnection attempts
  useEffect(() => {
    if (connectionState === "disconnected") {
      // Show reconnect button after a delay if still disconnected
      const timer = setTimeout(() => {
        setShowReconnectButton(true);
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setShowReconnectButton(false);
    }
  }, [connectionState]);

  // Handle manual reconnection
  const handleReconnect = () => {
    setShowReconnectButton(false);
    connect();
  };

  // Determine badge variant based on connection state
  const getBadgeVariant = () => {
    switch (connectionState) {
      case "connected":
        return "default" as const;
      case "connecting":
        return "outline" as const;
      case "disconnected":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  // Get human-readable status text
  const getStatusText = () => {
    switch (connectionState) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={getBadgeVariant()} className="px-2 py-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === "connected"
                ? "bg-green-500"
                : connectionState === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          {getStatusText()}
        </span>
      </Badge>

      {showReconnectButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleReconnect}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reconnect
        </Button>
      )}
    </div>
  );
}
