import { useState, useEffect } from "react";
import { useWebSocketStore, websocketService } from "@/services/websocket";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, WifiOff, Wifi } from "lucide-react";

interface WebSocketDebugProps {
  className?: string;
}

export function WebSocketDebug({ className = "" }: WebSocketDebugProps) {
  const {
    connectionState,
    subscribedSymbols,
    activeSymbol,
    lastError,
    lastHeartbeat,
    connect,
    disconnect,
  } = useWebSocketStore();

  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);

  // Update the last update time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time since last heartbeat
  const getTimeSinceLastHeartbeat = () => {
    if (!lastHeartbeat) return "Never";

    const seconds = Math.floor((Date.now() - lastHeartbeat) / 1000);

    if (seconds < 60) {
      return `${seconds} seconds ago`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes ago`;
    } else {
      return `${Math.floor(seconds / 3600)} hours ago`;
    }
  };

  // Get connection status badge
  const getConnectionBadge = () => {
    switch (connectionState) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge
            variant="outline"
            className="text-yellow-500 border-yellow-500"
          >
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="destructive">
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Handle reconnect
  const handleReconnect = () => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-sm font-medium">
              WebSocket Status
            </CardTitle>
            <CardDescription className="text-xs">
              {connectionState === "connected"
                ? "Real-time data is active"
                : connectionState === "connecting"
                ? "Establishing connection..."
                : "Connection is inactive"}
            </CardDescription>
          </div>
          {getConnectionBadge()}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pb-2 pt-0">
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">Status:</div>
              <div>{connectionState}</div>

              <div className="text-muted-foreground">Last Heartbeat:</div>
              <div>{getTimeSinceLastHeartbeat()}</div>

              <div className="text-muted-foreground">Active Symbol:</div>
              <div>{activeSymbol || "None"}</div>

              <div className="text-muted-foreground">Subscribed Symbols:</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(subscribedSymbols).length > 0 ? (
                  Array.from(subscribedSymbols).map((symbol) => (
                    <Badge
                      key={symbol}
                      variant="outline"
                      className={
                        symbol === activeSymbol
                          ? "bg-primary/10 border-primary"
                          : ""
                      }
                    >
                      {symbol}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>

              {lastError && (
                <>
                  <div className="text-muted-foreground">Last Error:</div>
                  <div className="text-red-500">{lastError}</div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      )}

      <CardFooter className="flex justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide Details" : "Show Details"}
        </Button>

        <div className="flex gap-2">
          {connectionState === "disconnected" ? (
            <Button
              variant="default"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={connect}
            >
              Connect
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleReconnect}
              >
                Reconnect
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
