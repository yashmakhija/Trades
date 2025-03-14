import { useEffect, useState } from "react";
import { useWebSocketStore, TickerData } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MarketTickerProps {
  symbol: string;
  className?: string;
}

export function MarketTicker({ symbol, className = "" }: MarketTickerProps) {
  // Get WebSocket data
  const { tickerData, subscribeToSymbol, connectionState } =
    useWebSocketStore();

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
    subscribeToSymbol(symbol);
  }, [symbol, subscribeToSymbol]);

  // Get ticker data for the symbol
  const ticker = tickerData[symbol.toLowerCase()];

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

      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Price</div>
            <div
              className={`text-2xl font-bold ${
                priceChangeDirection === "up"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              ${formatPrice(ticker?.price)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">24h Change</div>
            <div className="flex items-center">
              <div
                className={`text-lg font-semibold ${
                  priceChangeDirection === "up"
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {formatPercentChange(ticker?.priceChangePercent)}
              </div>
              {ticker?.priceChangePercent !== undefined &&
                (priceChangeDirection === "up" ? (
                  <ArrowUp className="ml-1 h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDown className="ml-1 h-4 w-4 text-red-500" />
                ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">24h Volume</div>
            <div className="text-lg font-semibold">
              {formatVolume(ticker?.volume)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Last Update</div>
            <div className="text-sm">
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
