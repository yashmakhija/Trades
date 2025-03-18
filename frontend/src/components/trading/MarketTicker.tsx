import { useEffect, useState, useRef } from "react";
import { useWebSocket } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, RefreshCw, Globe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    reconnect,
    activeSymbol,
  } = useWebSocket();

  // Track updates for animation
  const [hasUpdate, setHasUpdate] = useState(false);
  const prevPriceRef = useRef<number | undefined>(undefined);
  const prevSymbolRef = useRef<string | undefined>(undefined);

  // Add timezone toggle
  const [showUTC, setShowUTC] = useState(false);

  const normalizedSymbol = symbol.toLowerCase();

  // Format price with appropriate decimal places
  const formatPrice = (price: number | undefined): string => {
    if (price === undefined) return "-.--";

    // Determine decimal places based on price magnitude and symbol
    let decimalPlaces = 2;

    // Different symbols need different decimal places
    if (/btc|eth|bnb/.test(normalizedSymbol)) {
      // Higher value crypto needs fewer decimals
      decimalPlaces = price >= 10000 ? 2 : price >= 1000 ? 3 : 4;
    } else if (/sol|ada|dot/.test(normalizedSymbol)) {
      // Mid-range crypto needs more decimals
      decimalPlaces = price >= 100 ? 3 : price >= 10 ? 4 : 5;
    } else {
      // Default for other tokens
      decimalPlaces =
        price >= 1000 ? 2 : price >= 100 ? 3 : price >= 10 ? 4 : 5;
    }

    return price.toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  // Format percentage change
  const formatPercentChange = (change: number | undefined): string => {
    if (change === undefined) return "-.--";

    // Ensure we handle the percentage format correctly
    // The data comes from the server as a decimal (e.g., 2.406 for 2.406%)
    return `${change >= 0 ? "+" : ""}${Math.abs(change).toFixed(2)}%`;
  };

  // Format volume
  const formatVolume = (volume: number | undefined): string => {
    if (volume === undefined) return "-.--";

    // Handle large volume numbers with proper suffixes
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

  // Format timestamp with timezone
  const formatTime = (timestamp: number | undefined): string => {
    if (!timestamp) return "--:--:--";

    const date = new Date(timestamp);

    if (showUTC) {
      // Format as UTC time
      return date.toISOString().split("T")[1].split(".")[0] + " UTC";
    } else {
      // Format as local time
      return date.toLocaleTimeString();
    }
  };

  // Subscribe to symbol updates
  useEffect(() => {
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
  }, [normalizedSymbol, subscribeToSymbol, unsubscribeFromSymbol]);

  // Monitor when ticker data changes for this symbol
  useEffect(() => {
    const ticker = tickerData[normalizedSymbol];

    if (ticker) {
      console.log(`MarketTicker: Received update for ${normalizedSymbol}`, {
        price: ticker.price,
        priceChangePercent: ticker.priceChangePercent,
        volume: ticker.volume,
        timestamp: new Date(ticker.timestamp).toISOString(),
        high: ticker.high,
        low: ticker.low,
        openPrice: ticker.openPrice,
      });

      // Determine if we need to animate the price change
      if (
        prevPriceRef.current !== undefined &&
        ticker.price !== prevPriceRef.current &&
        prevSymbolRef.current === normalizedSymbol // Only animate if symbol hasn't changed
      ) {
        setHasUpdate(true);

        // Reset animation after 1 second
        const timer = setTimeout(() => {
          setHasUpdate(false);
        }, 1000);

        return () => clearTimeout(timer);
      }

      // Update refs for next comparison
      prevPriceRef.current = ticker.price;
      prevSymbolRef.current = normalizedSymbol;
    }
  }, [tickerData, normalizedSymbol]);

  // Update prev symbol ref when symbol changes
  useEffect(() => {
    prevSymbolRef.current = normalizedSymbol;
    // Reset prev price ref to avoid animation on symbol change
    prevPriceRef.current = undefined;
  }, [normalizedSymbol]);

  // Handle manual refresh
  const handleRefresh = () => {
    console.log(
      `MarketTicker: Manually refreshing ticker for ${normalizedSymbol}`
    );
    reconnect();
  };

  // Get ticker data for the symbol
  const ticker = tickerData[normalizedSymbol];

  // Determine price change direction
  const priceChangeDirection =
    (ticker?.priceChangePercent || 0) >= 0 ? "up" : "down";

  // Subscription status
  const isSubscribed = activeSymbol === normalizedSymbol;

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            {symbol.toUpperCase()}
            <Badge
              variant="outline"
              className={cn(
                "text-xs transition-colors",
                isSubscribed ? "bg-green-100 text-green-800" : "bg-slate-100"
              )}
            >
              {isSubscribed ? "Subscribed" : "Pending"}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="timezone-switch"
                checked={showUTC}
                onCheckedChange={setShowUTC}
                className="mt-0.5"
              />
              <Label htmlFor="timezone-switch" className="cursor-pointer">
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
              onClick={handleRefresh}
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Badge
              variant={
                connectionState === "connected" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {connectionState === "connected"
                ? "Live"
                : connectionState === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          {/* Price */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Price</div>
            <div
              className={cn(
                "text-2xl font-bold transition-colors",
                hasUpdate && (ticker?.price ?? 0) > (prevPriceRef.current ?? 0)
                  ? "text-green-500"
                  : "",
                hasUpdate && (ticker?.price ?? 0) < (prevPriceRef.current ?? 0)
                  ? "text-red-500"
                  : ""
              )}
            >
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

          {/* 24h Range */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">24h Range</div>
            <div className="text-lg font-medium">
              {ticker?.low && ticker?.high ? (
                <div className="flex justify-between items-center">
                  <span className="text-red-500">
                    {formatPrice(ticker.low)}
                  </span>
                  <span className="mx-1 text-muted-foreground"> - </span>
                  <span className="text-green-500">
                    {formatPrice(ticker.high)}
                  </span>
                </div>
              ) : (
                "--.-- - --.--"
              )}
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
          <div className="space-y-1 col-span-2">
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="text-lg font-medium">
              {formatTime(ticker?.timestamp)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
