import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  Search,
  Star,
  StarOff,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bitcoin,
  Euro,
  CandlestickChart,
  GripVertical,
  Plus,
  Minus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocketStore } from "@/services/websocket";
import { useMarketDataStore } from "@/store/use-market-data-store";
import { MarketSymbol } from "@/store/use-market-data-store";
import { DEFAULT_SYMBOLS } from "@/config";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOrderStore } from "@/store/use-order-store";
import { useAuthStore } from "@/store/use-auth-store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface MarketSidebarProps {
  className?: string;
}

function getSymbolIcon(symbol: string) {
  const lowercaseSymbol = symbol.toLowerCase();

  if (lowercaseSymbol.includes("btc") || lowercaseSymbol.includes("bitcoin")) {
    return <Bitcoin className="h-4 w-4 text-amber-400" />;
  } else if (
    lowercaseSymbol.includes("eth") ||
    lowercaseSymbol.includes("ethereum")
  ) {
    return (
      <Image
        src="/icons/eth.png"
        alt="ETH"
        width={16}
        height={16}
        className="opacity-80"
        onError={(e) => {
          e.currentTarget.src = "/icons/default-crypto.svg";
        }}
      />
    );
  } else if (
    lowercaseSymbol.includes("eur") ||
    lowercaseSymbol.includes("euro")
  ) {
    return <Euro className="h-4 w-4 text-blue-400" />;
  } else if (
    lowercaseSymbol.includes("usd") ||
    lowercaseSymbol.includes("dollar")
  ) {
    return <DollarSign className="h-4 w-4 text-green-400" />;
  }

  return <CandlestickChart className="h-4 w-4 text-gray-400" />;
}

interface SortableMarketItemProps {
  symbol: MarketSymbol;
  currentSymbol: string;
  onClick: () => void;
  getPriceChangeClass: (
    symbol: string,
    type: "bid" | "ask",
    currentPrice: number
  ) => string;
  attributes?: any;
  listeners?: any;
  isDragging?: boolean;
}

function SortableMarketItem({
  symbol,
  currentSymbol,
  onClick,
  getPriceChangeClass,
  attributes,
  listeners,
  isDragging,
}: SortableMarketItemProps) {
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: symbol.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { favoriteSymbols, addToFavorites, removeFromFavorites } =
    useMarketDataStore();

  const toggleFavorite = (e: React.MouseEvent, symbolName: string) => {
    e.stopPropagation();

    if (favoriteSymbols.includes(symbolName)) {
      removeFromFavorites(symbolName);
    } else {
      addToFavorites(symbolName);
    }
  };

  const formatPercentChange = (change: number) => {
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  const formatPrice = (price: number) => {
    if (!price) return "0.00";

    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 100) {
      return price.toFixed(2);
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(5);
    }
  };

  // Add state for quick trading dialog
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [isProfessional, setIsProfessional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { createOrder } = useOrderStore();

  // Handle quick trade button click
  const handleQuickTradeClick = (e: React.MouseEvent, type: "BUY" | "SELL") => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Authentication required", {
        description: "Please log in to place orders",
      });
      return;
    }
    setTradeType(type);
    setShowQuickTrade(true);
  };

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!isAuthenticated || !symbol) {
      toast.error("Authentication required");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        symbolId: symbol.id,
        type: tradeType,
        price:
          tradeType === "BUY" ? symbol.askPrice || 0 : symbol.bidPrice || 0,
        quantity: parseFloat(quantity),
        isShort: tradeType === "SELL",
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      };

      const newOrder = await createOrder(orderData);

      if (newOrder) {
        toast.success(`${tradeType} order placed successfully`);
        setShowQuickTrade(false);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onClick}
        className={cn(
          "hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/40 favorite-item-highlight group",
          symbol.name === currentSymbol && "bg-muted/60 font-medium",
          isDragging ? "sortable-item-dragging" : "sortable-item-transition",
          favoriteSymbols.includes(symbol.name) && "favorite-item-highlight"
        )}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <button
              onClick={(e) => toggleFavorite(e, symbol.name)}
              className="text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
            >
              {favoriteSymbols.includes(symbol.name) ? (
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ) : (
                <StarOff className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="flex items-center gap-1.5 flex-1">
              {getSymbolIcon(symbol.name)}
              <span className="uppercase font-medium text-sm">
                {symbol.name}
              </span>
            </div>
            {favoriteSymbols.includes(symbol.name) && (
              <div
                className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                {...(attributes || sortableAttributes)}
                {...(listeners || sortableListeners)}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-full text-center font-mono text-xs font-medium rounded px-1 py-0.5 transition-colors",
                  getPriceChangeClass(symbol.name, "bid", symbol.bidPrice || 0)
                )}
              >
                {formatPrice(symbol.bidPrice || 0)}
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                BID
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-full text-center font-mono text-xs font-medium rounded px-1 py-0.5 transition-colors",
                  getPriceChangeClass(symbol.name, "ask", symbol.askPrice || 0)
                )}
              >
                {formatPrice(symbol.askPrice || 0)}
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                ASK
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-full flex items-center justify-center gap-0.5 rounded px-1 py-0.5",
                  symbol.priceChangePercent >= 0
                    ? "bg-green-500/10 text-green-500"
                    : "bg-red-500/10 text-red-500"
                )}
              >
                {symbol.priceChangePercent >= 0 ? (
                  <TrendingUp className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 flex-shrink-0" />
                )}
                <span className="tabular-nums text-xs font-medium">
                  {formatPercentChange(symbol.priceChangePercent)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                24H
              </span>
            </div>
          </div>

          {/* Quick trade buttons - visible on hover */}
          <div className="flex justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleQuickTradeClick(e, "BUY")}
              className="bg-green-500/10 text-green-500 hover:bg-green-500/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Buy
            </button>
            <button
              onClick={(e) => handleQuickTradeClick(e, "SELL")}
              className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
            >
              <Minus className="h-3 w-3" /> Sell
            </button>
          </div>
        </div>
      </div>

      {/* Quick Trade Dialog */}
      <Dialog open={showQuickTrade} onOpenChange={setShowQuickTrade}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getSymbolIcon(symbol.name)}
              <span className="uppercase">{symbol.name}</span>
              <Badge
                variant={tradeType === "BUY" ? "default" : "destructive"}
                className={cn(
                  "ml-2",
                  tradeType === "BUY"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                )}
              >
                {tradeType}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Place a {tradeType.toLowerCase()} order for {symbol.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price
              </Label>
              <div className="col-span-3">
                <Input
                  id="price"
                  value={formatPrice(
                    tradeType === "BUY"
                      ? symbol.askPrice || 0
                      : symbol.bidPrice || 0
                  )}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <div className="col-span-3">
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.00001"
                  step="0.00001"
                />
              </div>
            </div>

            {isProfessional && (
              <>
                <Separator />
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stopLoss" className="text-right">
                    Stop Loss
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="stopLoss"
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="Optional"
                      min="0"
                      step="0.00001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="takeProfit" className="text-right">
                    Take Profit
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="takeProfit"
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="Optional"
                      min="0"
                      step="0.00001"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="professional">Professional Trading</Label>
              </div>
              <Switch
                id="professional"
                checked={isProfessional}
                onCheckedChange={setIsProfessional}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickTrade(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className={cn(
                tradeType === "BUY"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tradeType} {symbol.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MarketSidebar({ className }: MarketSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSymbol =
    searchParams.get("symbol")?.toLowerCase() || DEFAULT_SYMBOLS[0];

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [, setActiveId] = useState<string | null>(null);
  const [favoriteOrder, setFavoriteOrder] = useState<string[]>([]);

  // Add state for quick trading dialog
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [isProfessional, setIsProfessional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol | null>(
    null
  );
  const { isAuthenticated } = useAuthStore();
  const { createOrder } = useOrderStore();

  const { tickerData, connectionState } = useWebSocketStore();
  const {
    symbols: marketSymbols,
    favoriteSymbols,
    updateSymbol,
    reorderFavorites,
  } = useMarketDataStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setFavoriteOrder(favoriteSymbols);
  }, [favoriteSymbols]);

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

  const filteredSymbols = marketSymbols.filter((symbol) => {
    const matchesSearch =
      searchQuery === "" ||
      symbol.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "favorites" && favoriteSymbols.includes(symbol.name));

    return matchesSearch && matchesTab;
  });

  const sortedSymbols = [...filteredSymbols].sort((a, b) => {
    const aIsFavorite = favoriteSymbols.includes(a.name);
    const bIsFavorite = favoriteSymbols.includes(b.name);

    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;

    if (aIsFavorite && bIsFavorite) {
      const aIndex = favoriteOrder.indexOf(a.name);
      const bIndex = favoriteOrder.indexOf(b.name);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
    }

    return a.name.localeCompare(b.name);
  });

  const handleSelectSymbol = (symbol: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("symbol", symbol);

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = favoriteOrder.indexOf(active.id as string);
      const overIndex = favoriteOrder.indexOf(over.id as string);

      if (activeIndex !== -1 && overIndex !== -1) {
        const newOrder = arrayMove(favoriteOrder, activeIndex, overIndex);
        setFavoriteOrder(newOrder);
        reorderFavorites(newOrder);
      }
    }

    setActiveId(null);
  };

  const formatPercentChange = (change: number) => {
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  const [prevPrices, setPrevPrices] = useState<
    Record<string, { bid: number; ask: number }>
  >({});

  useEffect(() => {
    const newPrevPrices: Record<string, { bid: number; ask: number }> = {};

    marketSymbols.forEach((symbol) => {
      newPrevPrices[symbol.name] = {
        bid: symbol.bidPrice || 0,
        ask: symbol.askPrice || 0,
      };
    });

    const timer = setTimeout(() => {
      setPrevPrices(newPrevPrices);
    }, 1000);

    return () => clearTimeout(timer);
  }, [marketSymbols]);

  const getPriceChangeClass = (
    symbol: string,
    type: "bid" | "ask",
    currentPrice: number
  ) => {
    if (!prevPrices[symbol]) return "";

    const prevPrice =
      type === "bid" ? prevPrices[symbol].bid : prevPrices[symbol].ask;

    if (currentPrice > prevPrice) {
      return "bg-green-500/10 text-green-500 animate-price-up";
    } else if (currentPrice < prevPrice) {
      return "bg-red-500/10 text-red-500 animate-price-down";
    }

    return "";
  };

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!isAuthenticated || !selectedSymbol) {
      toast.error("Authentication required");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        symbolId: selectedSymbol.name.toLowerCase(),
        type: tradeType,
        price:
          tradeType === "BUY"
            ? selectedSymbol.askPrice || 0
            : selectedSymbol.bidPrice || 0,
        quantity: parseFloat(quantity),
        isShort: tradeType === "SELL",
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      };

      const newOrder = await createOrder(orderData);

      if (newOrder) {
        toast.success(`${tradeType} order placed successfully`);
        setShowQuickTrade(false);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 shadow-md bg-card/70 backdrop-blur-sm h-full",
        className
      )}
    >
      <CardHeader className="px-4 py-3 border-b border-border/60">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CandlestickChart className="h-5 w-5 text-primary/80" />
            Market Overview
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-xs py-0.5",
              connectionState === "connected"
                ? "bg-green-500/10 text-green-500 border-green-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}
          >
            {connectionState === "connected" ? (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Connecting
              </span>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>

      <div className="px-4 py-3 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            className="pl-9 h-9 text-sm bg-background/60"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border/60">
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | "favorites")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="favorites" className="text-xs">
              <Star className="h-3.5 w-3.5 mr-1.5" />
              FAVORITES
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              ALL MARKETS
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-y-auto h-[calc(100%-160px)] scrollbar-thin">
        {connectionState !== "connected" ? (
          <div className="flex items-center justify-center p-8 text-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting to market data...
          </div>
        ) : sortedSymbols.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {activeTab === "favorites" ? (
              <div className="flex flex-col items-center gap-2">
                <Star className="h-10 w-10 text-muted-foreground/30" />
                <p>No favorite symbols yet</p>
              </div>
            ) : searchQuery ? (
              `No symbols matching "${searchQuery}"`
            ) : (
              "No market data available"
            )}
          </div>
        ) : (
          <div>
            <div className="sticky top-0 bg-muted/70 backdrop-blur-sm z-10 text-xs font-medium border-b border-border/60">
              <div className="grid grid-cols-12 px-4 py-2">
                <div className="col-span-5">Symbol</div>
                <div className="col-span-7">
                  <div className="grid grid-cols-3 w-full">
                    <div className="text-center">Bid</div>
                    <div className="text-center">Ask</div>
                    <div className="text-center">24h</div>
                  </div>
                </div>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              modifiers={[]}
            >
              {activeTab === "favorites" && favoriteSymbols.length > 0 ? (
                <SortableContext
                  items={sortedSymbols.map((s) => s.name)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedSymbols.map((symbol) => (
                    <SortableMarketItem
                      key={symbol.name}
                      symbol={symbol}
                      currentSymbol={currentSymbol}
                      onClick={() => handleSelectSymbol(symbol.name)}
                      getPriceChangeClass={getPriceChangeClass}
                    />
                  ))}
                </SortableContext>
              ) : (
                sortedSymbols.map((symbol) => (
                  <div
                    key={symbol.name}
                    onClick={() => handleSelectSymbol(symbol.name)}
                    className={cn(
                      "hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/40 group",
                      symbol.name === currentSymbol &&
                        "bg-muted/60 font-medium",
                      favoriteSymbols.includes(symbol.name) &&
                        "favorite-item-highlight"
                    )}
                  >
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <button
                          onClick={(e) => toggleFavorite(e, symbol.name)}
                          className="text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                        >
                          {favoriteSymbols.includes(symbol.name) ? (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ) : (
                            <StarOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div className="flex items-center gap-1.5 flex-1">
                          {getSymbolIcon(symbol.name)}
                          <span className="uppercase font-medium text-sm">
                            {symbol.name}
                          </span>
                        </div>
                        {favoriteSymbols.includes(symbol.name) && (
                          <div className="text-muted-foreground/30">
                            <GripVertical className="h-4 w-4 opacity-30" />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "w-full text-center font-mono text-xs font-medium rounded px-1 py-0.5 transition-colors",
                              getPriceChangeClass(
                                symbol.name,
                                "bid",
                                symbol.bidPrice || 0
                              )
                            )}
                          >
                            {formatPrice(symbol.bidPrice || 0)}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            BID
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "w-full text-center font-mono text-xs font-medium rounded px-1 py-0.5 transition-colors",
                              getPriceChangeClass(
                                symbol.name,
                                "ask",
                                symbol.askPrice || 0
                              )
                            )}
                          >
                            {formatPrice(symbol.askPrice || 0)}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            ASK
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "w-full flex items-center justify-center gap-0.5 rounded px-1 py-0.5",
                              symbol.priceChangePercent >= 0
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                            )}
                          >
                            {symbol.priceChangePercent >= 0 ? (
                              <TrendingUp className="h-3 w-3 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="tabular-nums text-xs font-medium">
                              {formatPercentChange(symbol.priceChangePercent)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            24H
                          </span>
                        </div>
                      </div>

                      {/* Quick trade buttons - visible on hover */}
                      <div className="flex justify-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isAuthenticated) {
                              toast.error("Authentication required", {
                                description: "Please log in to place orders",
                              });
                              return;
                            }
                            setTradeType("BUY");
                            setShowQuickTrade(true);
                            setSelectedSymbol(symbol);
                          }}
                          className="bg-green-500/10 text-green-500 hover:bg-green-500/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Buy
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isAuthenticated) {
                              toast.error("Authentication required", {
                                description: "Please log in to place orders",
                              });
                              return;
                            }
                            setTradeType("SELL");
                            setShowQuickTrade(true);
                            setSelectedSymbol(symbol);
                          }}
                          className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                        >
                          <Minus className="h-3 w-3" /> Sell
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </DndContext>
          </div>
        )}
      </div>

      {/* Quick Trade Dialog for non-sortable items */}
      <Dialog open={showQuickTrade} onOpenChange={setShowQuickTrade}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSymbol && getSymbolIcon(selectedSymbol.name)}
              <span className="uppercase">{selectedSymbol?.name}</span>
              <Badge
                variant={tradeType === "BUY" ? "default" : "destructive"}
                className={cn(
                  "ml-2",
                  tradeType === "BUY"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                )}
              >
                {tradeType}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Place a {tradeType.toLowerCase()} order for {selectedSymbol?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price
              </Label>
              <div className="col-span-3">
                <Input
                  id="price"
                  value={formatPrice(
                    selectedSymbol
                      ? tradeType === "BUY"
                        ? selectedSymbol.askPrice || 0
                        : selectedSymbol.bidPrice || 0
                      : 0
                  )}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <div className="col-span-3">
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.00001"
                  step="0.00001"
                />
              </div>
            </div>

            {isProfessional && (
              <>
                <Separator />
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stopLoss" className="text-right">
                    Stop Loss
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="stopLoss"
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="Optional"
                      min="0"
                      step="0.00001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="takeProfit" className="text-right">
                    Take Profit
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="takeProfit"
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="Optional"
                      min="0"
                      step="0.00001"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="professional">Professional Trading</Label>
              </div>
              <Switch
                id="professional"
                checked={isProfessional}
                onCheckedChange={setIsProfessional}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickTrade(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className={cn(
                tradeType === "BUY"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tradeType} {selectedSymbol?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Helper function to toggle favorites
function toggleFavorite(e: React.MouseEvent, symbolName: string) {
  const { favoriteSymbols, addToFavorites, removeFromFavorites } =
    useMarketDataStore.getState();
  e.stopPropagation();

  if (favoriteSymbols.includes(symbolName)) {
    removeFromFavorites(symbolName);
  } else {
    addToFavorites(symbolName);
  }
}

// Helper function to format price
function formatPrice(price: number): string {
  if (!price) return "0.00";

  if (price >= 1000) {
    return price.toFixed(2);
  } else if (price >= 100) {
    return price.toFixed(2);
  } else if (price >= 1) {
    return price.toFixed(4);
  } else {
    return price.toFixed(5);
  }
}
