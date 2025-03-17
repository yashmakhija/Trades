import { useEffect } from "react";
import { useWebSocket } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MarketTickerProps {
  symbol: string;
  className?: string;
}

export function MarketTicker({ symbol, className = "" }: MarketTickerProps) {
  // Get WebSocket data
  const {
    tickerData,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    connectionState,
  } = useWebSocket();

  // Format price with appropriate decimal places
  const formatPrice = (price: number | undefined): string => {
    if (price === undefined) return "-.--";

    // Determine decimal places based on price magnitude
    const decimalPlaces =
      price >= 1000 ? 2 : price >= 100 ? 3 : price >= 10 ? 4 : 5;

    return price.toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  // Format percentage change
  const formatPercentChange = (change: number | undefined): string => {
    if (change === undefined) return "-.--";

    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  // Format volume
  const formatVolume = (volume: number | undefined): string => {
    if (volume === undefined) return "-.--";

    if (volume >= 1_000_000_000) {
      return `${(volume / 1_000_000_000).toFixed(2)}B`;
    } else if (volume >= 1_000_000) {
      return `${(volume / 1_000_000).toFixed(2)}M`;
    } else if (volume >= 1_000) {
      return `${(volume / 1_000).toFixed(2)}K`;
    } else {
      return volume.toFixed(2);
    }
  };

  // Subscribe to symbol updates
  useEffect(() => {
    const normalizedSymbol = symbol.toLowerCase();
    console.log(`MarketTicker: Subscribing to symbol ${normalizedSymbol}`);

    // Subscribe to the symbol
    subscribeToSymbol(normalizedSymbol);

    // Clean up on unmount or when symbol changes
    return () => {
      console.log(
        `MarketTicker: Unsubscribing from symbol ${normalizedSymbol}`
      );
      unsubscribeFromSymbol(normalizedSymbol);
    };
  }, [symbol, subscribeToSymbol, unsubscribeFromSymbol]);

  // Get ticker data for the symbol
  const normalizedSymbol = symbol.toLowerCase();
  const ticker = tickerData[normalizedSymbol];

  // Determine price change direction
  const priceChangeDirection = ticker?.priceChangePercent >= 0 ? "up" : "down";

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">
            {symbol.toUpperCase()}
          </CardTitle>

          <Badge
            variant={connectionState === "connected" ? "default" : "secondary"}
            className="text-xs"
          >
            {connectionState === "connected"
              ? "Live"
              : connectionState === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          {/* Price */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Price</div>
            <div className="text-2xl font-bold">
              {formatPrice(ticker?.price)}
            </div>
          </div>

          {/* 24h Change */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">24h Change</div>
            <div
              className={`text-2xl font-bold flex items-center ${
                priceChangeDirection === "up"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {priceChangeDirection === "up" ? (
                <ArrowUp className="mr-1 h-5 w-5" />
              ) : (
                <ArrowDown className="mr-1 h-5 w-5" />
              )}
              {formatPercentChange(ticker?.priceChangePercent)}
            </div>
          </div>

          {/* 24h Volume */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">24h Volume</div>
            <div className="text-lg font-medium">
              {formatVolume(ticker?.volume)}
            </div>
          </div>

          {/* Last Updated */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="text-lg font-medium">
              {ticker?.timestamp
                ? new Date(ticker.timestamp).toLocaleTimeString()
                : "--:--:--"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
