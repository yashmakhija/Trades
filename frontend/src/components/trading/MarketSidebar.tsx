import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Star,
  StarOff,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocketStore } from "@/services/websocket";
import { useMarketDataStore } from "@/store/use-market-data-store";
import { DEFAULT_SYMBOLS } from "@/config";

interface MarketSidebarProps {
  className?: string;
}

export function MarketSidebar({ className }: MarketSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get the current symbol from URL or use the first default symbol
  const currentSymbol =
    searchParams.get("symbol")?.toLowerCase() || DEFAULT_SYMBOLS[0];

  // State for search and tab filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");

  // Get WebSocket and market data
  const { tickerData, connectionState } = useWebSocketStore();
  const {
    symbols: marketSymbols,
    favoriteSymbols,
    addToFavorites,
    removeFromFavorites,
    updateSymbol,
  } = useMarketDataStore();

  // Process ticker data into market data store
  useEffect(() => {
    Object.entries(tickerData).forEach(([symbol, data]) => {
      updateSymbol({
        name: symbol,
        price: data.price,
        priceChangePercent: data.priceChangePercent,
        volume: data.volume,
        high: data.high || null,
        low: data.low || null,
      });
    });
  }, [tickerData, updateSymbol]);

  // Filter symbols based on search query and active tab
  const filteredSymbols = marketSymbols.filter((symbol) => {
    const matchesSearch =
      searchQuery === "" ||
      symbol.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "favorites" && favoriteSymbols.includes(symbol.name));

    return matchesSearch && matchesTab;
  });

  // Sort symbols: favorites first, then by name
  const sortedSymbols = [...filteredSymbols].sort((a, b) => {
    const aIsFavorite = favoriteSymbols.includes(a.name);
    const bIsFavorite = favoriteSymbols.includes(b.name);

    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;

    return a.name.localeCompare(b.name);
  });

  // Handle symbol selection
  const handleSelectSymbol = (symbol: string) => {
    // Create new search params
    const params = new URLSearchParams(searchParams);
    params.set("symbol", symbol);

    // Navigate to the same page with updated symbol
    router.push(`${pathname}?${params.toString()}`);
  };

  // Toggle favorite status
  const toggleFavorite = (e: React.MouseEvent, symbolName: string) => {
    e.stopPropagation(); // Prevent triggering the row click

    if (favoriteSymbols.includes(symbolName)) {
      removeFromFavorites(symbolName);
    } else {
      addToFavorites(symbolName);
    }
  };

  // Format price for display
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 100) {
      return price.toFixed(3);
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  };

  // Format percentage change
  const formatPercentChange = (change: number) => {
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 shadow-md bg-card h-full",
        className
      )}
    >
      <CardHeader className="px-3 py-2 border-b border-border">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          Market Overview
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              connectionState === "connected"
                ? "bg-green-500/10 text-green-500 border-green-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}
          >
            {connectionState === "connected" ? "Live" : "Connecting..."}
          </Badge>
        </CardTitle>
      </CardHeader>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search eg: EUR/USD, BTC"
            className="pl-8 h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | "favorites")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="favorites" className="text-xs">
              FAVORITES
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              ALL SYMBOLS
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="text-xs font-medium border-b border-border bg-muted/40">
        <div className="grid grid-cols-12 px-3 py-2">
          <div className="col-span-5">Symbol</div>
          <div className="col-span-3 text-right">Bid</div>
          <div className="col-span-4 text-right">Ask</div>
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100%-140px)]">
        {connectionState !== "connected" ? (
          <div className="flex items-center justify-center p-8 text-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting to market data...
          </div>
        ) : sortedSymbols.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {activeTab === "favorites"
              ? "No favorite symbols yet"
              : searchQuery
              ? `No symbols matching "${searchQuery}"`
              : "No market data available"}
          </div>
        ) : (
          <div>
            {sortedSymbols.map((symbol) => (
              <div
                key={symbol.name}
                onClick={() => handleSelectSymbol(symbol.name)}
                className={cn(
                  "grid grid-cols-12 px-3 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer text-xs",
                  symbol.name === currentSymbol && "bg-muted/50 font-medium"
                )}
              >
                <div className="col-span-5 flex items-center gap-1.5 truncate">
                  <button
                    onClick={(e) => toggleFavorite(e, symbol.name)}
                    className="opacity-60 hover:opacity-100 focus:outline-none"
                  >
                    {favoriteSymbols.includes(symbol.name) ? (
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <span className="truncate uppercase font-medium">
                    {symbol.name}
                  </span>

                  {/* Change percentage indicator */}
                  <div
                    className={cn(
                      "ml-1 text-[10px] px-1.5 py-0.5 rounded flex items-center",
                      symbol.priceChangePercent >= 0
                        ? "text-green-500 bg-green-950/30"
                        : "text-red-500 bg-red-950/30"
                    )}
                  >
                    {symbol.priceChangePercent >= 0 ? (
                      <TrendingUp className="h-2 w-2 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-2 w-2 mr-0.5" />
                    )}
                    {formatPercentChange(symbol.priceChangePercent)}
                  </div>
                </div>

                <div
                  className={cn(
                    "col-span-3 text-right font-mono",
                    symbol.priceChangePercent < 0 && "text-red-500"
                  )}
                >
                  {formatPrice(symbol.bidPrice)}
                </div>

                <div
                  className={cn(
                    "col-span-4 text-right font-mono",
                    symbol.priceChangePercent >= 0 && "text-green-500"
                  )}
                >
                  {formatPrice(symbol.askPrice)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
