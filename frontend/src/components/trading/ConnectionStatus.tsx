import { useEffect, useState } from "react";
import { useWebSocket } from "@/services/websocket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Globe, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const { connectionState, connect, lastHeartbeat } = useWebSocket();
  const [showReconnectButton, setShowReconnectButton] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showUTC, setShowUTC] = useState(false);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  // Format time based on selected timezone
  const formatTime = (date: Date) => {
    if (showUTC) {
      // Format as UTC time
      return date.toISOString().split("T")[1].split(".")[0] + " UTC";
    } else {
      // Format as local time with milliseconds
      return `${date.toLocaleTimeString()}.${date
        .getMilliseconds()
        .toString()
        .padStart(3, "0")}`;
    }
  };

  // Calculate time since last heartbeat
  const getLastHeartbeatTime = () => {
    if (!lastHeartbeat) return "No data";

    const timeSince = Math.floor((Date.now() - lastHeartbeat) / 1000);

    if (timeSince < 60) {
      return `${timeSince}s ago`;
    } else if (timeSince < 3600) {
      return `${Math.floor(timeSince / 60)}m ${timeSince % 60}s ago`;
    } else {
      return `${Math.floor(timeSince / 3600)}h ${Math.floor(
        (timeSince % 3600) / 60
      )}m ago`;
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

      <div className="flex items-center gap-2 ml-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="timezone-switch"
            checked={showUTC}
            onCheckedChange={setShowUTC}
            className="h-3 w-6"
          />
          <Label htmlFor="timezone-switch" className="cursor-pointer">
            {showUTC ? (
              <Globe className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
          </Label>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="px-2 py-1 text-xs">
              {formatTime(currentTime)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Current time</p>
          </TooltipContent>
        </Tooltip>

        {connectionState === "connected" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="px-2 py-1 text-xs">
                Last HB: {getLastHeartbeatTime()}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Last heartbeat received from server</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
