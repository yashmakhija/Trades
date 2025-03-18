import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Pause, Play, Globe, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/services/websocket";

interface Message {
  id: string;
  timestamp: number;
  content: string;
  type: string;
  symbol?: string;
}

interface WebSocketDebugPanelProps {
  className?: string;
}

export function WebSocketDebugPanel({
  className = "",
}: WebSocketDebugPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const [showUTC, setShowUTC] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { connectionState } = useWebSocket();

  // Set up message listener
  useEffect(() => {
    if (paused) return;

    // Function to intercept and log WebSocket messages
    const handleSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const timestamp = Date.now();
        const id = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;

        setMessages((prev) => {
          // Keep only the last 100 messages to avoid memory issues
          const newMessages = [
            ...prev,
            {
              id,
              timestamp,
              content:
                typeof event.data === "string"
                  ? event.data
                  : JSON.stringify(event.data),
              type: data.type || "UNKNOWN",
              symbol: data.symbol?.toLowerCase(),
            },
          ];

          if (newMessages.length > 100) {
            return newMessages.slice(-100);
          }
          return newMessages;
        });

        // Auto-scroll to bottom
        if (scrollAreaRef.current) {
          setTimeout(() => {
            if (scrollAreaRef.current) {
              scrollAreaRef.current.scrollTop =
                scrollAreaRef.current.scrollHeight;
            }
          }, 0);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    // Add message listener by monkey-patching WebSocket.prototype.onmessage
    const originalWebSocketPrototype = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      // Call the original send method
      originalWebSocketPrototype.call(this, data);

      // Log outgoing messages
      try {
        // Handle different data types
        let messageContent = "";
        let parsedData = null;

        if (typeof data === "string") {
          messageContent = data;
          parsedData = JSON.parse(data);
        } else if (data instanceof ArrayBuffer) {
          messageContent = `[Binary data: ${data.byteLength} bytes]`;
        } else if (data instanceof Blob) {
          messageContent = `[Blob data: ${data.size} bytes]`;
        } else {
          messageContent = String(data);
        }

        const timestamp = Date.now();
        const id = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;

        setMessages((prev) => {
          const newMessages = [
            ...prev,
            {
              id,
              timestamp,
              content: messageContent,
              type: parsedData
                ? `OUTGOING:${parsedData.type || "UNKNOWN"}`
                : "OUTGOING:BINARY",
              symbol: parsedData?.symbol?.toLowerCase(),
            },
          ];

          if (newMessages.length > 100) {
            return newMessages.slice(-100);
          }
          return newMessages;
        });
      } catch (e) {
        // Ignore errors parsing outgoing messages
        console.log("Failed to parse outgoing message", e);
      }
    };

    // Use MutationObserver to detect when WebSocket messages are added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (
              node.nodeType === Node.TEXT_NODE &&
              node.textContent?.includes("WebSocket:")
            ) {
              // This is a WebSocket log message
              console.log("WebSocket log detected:", node.textContent);
            }
          }
        }
      });
    });

    // Start observing console output
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Monkey patch console.log to capture WebSocket logs
    const originalConsoleLog = console.log;
    console.log = function (...args) {
      originalConsoleLog.apply(console, args);

      // Check if this is a WebSocket log
      const firstArg = args[0];
      if (typeof firstArg === "string" && firstArg.includes("WebSocket:")) {
        const timestamp = Date.now();
        const id = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;

        let type = "LOG";
        let symbol = "";

        // Try to extract type and symbol from log message
        if (firstArg.includes("24hr ticker for")) {
          type = "24hrTicker";
          const matches = firstArg.match(/24hr ticker for ([a-z0-9]+)/i);
          if (matches && matches[1]) {
            symbol = matches[1].toLowerCase();
          }
        } else if (firstArg.includes("TICKER_UPDATE")) {
          type = "TICKER_UPDATE";
          const matches = firstArg.match(/TICKER_UPDATE for ([a-z0-9]+)/i);
          if (matches && matches[1]) {
            symbol = matches[1].toLowerCase();
          }
        }

        setMessages((prev) => {
          const newMessages = [
            ...prev,
            {
              id,
              timestamp,
              content: args
                .map((arg) =>
                  typeof arg === "object"
                    ? JSON.stringify(arg, null, 2)
                    : String(arg)
                )
                .join(" "),
              type,
              symbol,
            },
          ];

          if (newMessages.length > 100) {
            return newMessages.slice(-100);
          }
          return newMessages;
        });
      }
    };

    // Listen for actual WebSocket messages
    window.addEventListener("message", (event) => {
      if (event.data && event.data.source === "websocket-debug") {
        handleSocketMessage(event.data.message);
      }
    });

    return () => {
      // Restore original WebSocket.prototype.send
      WebSocket.prototype.send = originalWebSocketPrototype;

      // Restore original console.log
      console.log = originalConsoleLog;

      // Disconnect observer
      observer.disconnect();

      // Remove event listener
      window.removeEventListener("message", handleSocketMessage);
    };
  }, [paused]);

  // Format timestamp based on selected timezone
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);

    if (showUTC) {
      return `${date.toISOString().replace("T", " ").replace("Z", " UTC")}`;
    } else {
      return `${date.toLocaleTimeString()}.${date
        .getMilliseconds()
        .toString()
        .padStart(3, "0")}`;
    }
  };

  // Filter messages
  const filteredMessages = messages.filter((message) => {
    if (filterSymbol && message.symbol !== filterSymbol) {
      return false;
    }
    if (filterType && !message.type.includes(filterType)) {
      return false;
    }
    return true;
  });

  // Clear all messages
  const handleClear = () => {
    setMessages([]);
  };

  // Download messages as JSON
  const handleDownload = () => {
    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileName = `websocket-logs-${new Date().toISOString()}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileName);
    linkElement.click();
    linkElement.remove();
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">WebSocket Debug</CardTitle>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                connectionState === "connected" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {connectionState === "connected"
                ? "Connected"
                : connectionState === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </Badge>

            <div className="flex items-center space-x-2">
              <Switch
                id="timezone-switch-debug"
                checked={showUTC}
                onCheckedChange={setShowUTC}
                className="mt-0.5"
              />
              <Label htmlFor="timezone-switch-debug" className="cursor-pointer">
                {showUTC ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </Label>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPaused(!paused)}
              title={paused ? "Resume logging" : "Pause logging"}
            >
              {paused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleClear}
              title="Clear logs"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleDownload}
              title="Download logs"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-grow">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm">Filter: </div>
          <input
            type="text"
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value.toLowerCase())}
            placeholder="Symbol"
            className="px-2 py-1 text-xs rounded border"
          />
          <input
            type="text"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            placeholder="Message type"
            className="px-2 py-1 text-xs rounded border"
          />
        </div>

        <ScrollArea
          className="h-[calc(100vh-16rem)] rounded-md border p-2 bg-muted/20"
          ref={scrollAreaRef}
        >
          <div className="space-y-1 font-mono text-xs">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className="border-b border-border pb-1 whitespace-pre-wrap"
              >
                <span className="text-muted-foreground">
                  [{formatTimestamp(message.timestamp)}]
                </span>
                {message.symbol && (
                  <span className="ml-1 px-1 bg-primary/10 rounded text-primary">
                    {message.symbol}
                  </span>
                )}
                <span className="ml-1 px-1 bg-secondary/10 rounded text-secondary">
                  {message.type}
                </span>
                <div className="mt-1 overflow-x-auto">{message.content}</div>
              </div>
            ))}
            {filteredMessages.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">
                {paused
                  ? "Logging is paused"
                  : messages.length === 0
                  ? "No messages yet"
                  : "No messages match the current filters"}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
