import { useEffect } from "react";
import { useWebSocketStore } from "@/services/websocket";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className = "" }: ConnectionStatusProps) {
  const { connectionState } = useWebSocketStore();

  // Show toast notifications when connection state changes
  useEffect(() => {
    if (connectionState === "connected") {
      toast.success("Connected to server", {
        description: "Real-time market data is now available",
        icon: <Wifi className="h-4 w-4" />,
      });
    } else if (connectionState === "disconnected") {
      toast.error("Disconnected from server", {
        description: "Attempting to reconnect...",
        icon: <WifiOff className="h-4 w-4" />,
      });
    }
  }, [connectionState]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge
        variant={
          connectionState === "connected"
            ? "default"
            : connectionState === "connecting"
            ? "outline"
            : "destructive"
        }
        className="text-xs"
      >
        {connectionState === "connected" ? (
          <>
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </>
        ) : connectionState === "connecting" ? (
          <>
            <span className="animate-pulse mr-1">⋯</span>
            Connecting
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </>
        )}
      </Badge>
    </div>
  );
}
