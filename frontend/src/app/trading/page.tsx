"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/trading/PriceChart";
import { MarketTicker } from "@/components/trading/MarketTicker";
import { SymbolSelector } from "@/components/trading/SymbolSelector";
import { OrderForm } from "@/components/trading/OrderForm";
import { OrderList } from "@/components/trading/OrderList";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { WebSocketDebug } from "@/components/trading/WebSocketDebug";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import { useWebSocket } from "@/services/websocket";
import { Toaster } from "sonner";
import { DEFAULT_SYMBOLS } from "@/config";
import { fetchSymbols } from "@/services/marketData";
import { TradingAnalytics } from "@/components/trading/TradingAnalytics";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  BookOpen,
  ListOrdered,
  BarChart4,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TradingPage() {
  const searchParams = useSearchParams();

  // Get symbol from URL or use default
  const symbolParam = searchParams.get("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    DEFAULT_SYMBOLS[0]
  );

  // State for active tab and UI controls
  const [activeTab, setActiveTab] = useState("chart");
  const [showDebug, setShowDebug] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [sidebarView, setSidebarView] = useState<"orders" | "form">("form");

  // Use the WebSocket hook
  const {
    connect,
    setActiveSymbol,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    activeSymbol,
  } = useWebSocket();

  // Load symbols and resolve symbol ID to name if needed
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const symbols = await fetchSymbols();

        // If we have a symbol ID in the URL, resolve it to a name
        if (symbolParam && symbolParam.includes("-")) {
          const symbolName = symbols
            .find((s) => s.id === symbolParam)
            ?.name.toLowerCase();
          if (symbolName) {
            setSelectedSymbol(symbolName);
          } else {
            // If we can't find the symbol by ID, use the first default
            setSelectedSymbol(DEFAULT_SYMBOLS[0]);
          }
        } else if (symbolParam) {
          // If it's not an ID, assume it's a name
          setSelectedSymbol(symbolParam.toLowerCase());
        }
      } catch (error) {
        console.error("Error loading symbols:", error);
        // If we can't load symbols, use the default
        if (symbolParam && !symbolParam.includes("-")) {
          setSelectedSymbol(symbolParam.toLowerCase());
        } else {
          setSelectedSymbol(DEFAULT_SYMBOLS[0]);
        }
      }
    };

    loadSymbols();
  }, [symbolParam]);

  // Ensure WebSocket connection is established
  useEffect(() => {
    console.log("TradingPage: Initializing WebSocket connection");

    // Connect to WebSocket if not already connected
    connect();

    // Return cleanup function
    return () => {
      console.log("TradingPage: Cleaning up");
      // We don't disconnect here to maintain the connection for other pages
    };
  }, [connect]);

  // Handle symbol changes
  useEffect(() => {
    if (!selectedSymbol) return;

    console.log(`TradingPage: Setting active symbol to ${selectedSymbol}`);

    // Unsubscribe from previous symbol if it exists and is different
    if (activeSymbol && activeSymbol !== selectedSymbol) {
      console.log(
        `TradingPage: Unsubscribing from previous symbol ${activeSymbol}`
      );
      unsubscribeFromSymbol(activeSymbol);
    }

    // Set the current symbol as active for optimized updates
    setActiveSymbol(selectedSymbol);

    // Subscribe to the selected symbol
    subscribeToSymbol(selectedSymbol);
  }, [
    selectedSymbol,
    setActiveSymbol,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    activeSymbol,
  ]);

  // Toggle debug panel with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setShowDebug((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="container mx-auto py-4 px-4 max-w-7xl">
      {/* Toast provider for notifications */}
      <Toaster position="top-right" richColors />

      <div className="flex flex-col space-y-4">
        {/* Header with connection status and symbol selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-card p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Typography variant="h1" className="text-2xl font-bold">
              Trading Dashboard
            </Typography>
            <ConnectionStatus />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="w-full md:w-64">
              <SymbolSelector />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowDebug(!showDebug)}
              title={showDebug ? "Hide Debug Panel" : "Show Debug Panel"}
            >
              {showDebug ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Main trading interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Market ticker at the top */}
            <MarketTicker symbol={selectedSymbol} />

            {/* Chart and data tabs */}
            <Card className="overflow-hidden border-none shadow-md">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="pb-0">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">
                      {selectedSymbol.toUpperCase()} Market Data
                    </CardTitle>
                    <TabsList>
                      <TabsTrigger
                        value="chart"
                        className="flex items-center gap-1"
                      >
                        <LineChart className="h-4 w-4" />
                        <span className="hidden sm:inline">Chart</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="orderbook"
                        className="flex items-center gap-1"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">Order Book</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="trades"
                        className="flex items-center gap-1"
                      >
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline">Trades</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <TabsContent value="chart" className="mt-0">
                    <PriceChart
                      symbol={selectedSymbol}
                      height={500}
                      useMockData={false} // Use real data from backend
                    />
                  </TabsContent>

                  <TabsContent value="orderbook" className="mt-0">
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      <div className="text-center">
                        <BookOpen className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                        <p>Order book will be implemented in a future update</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="trades" className="mt-0">
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      <div className="text-center">
                        <ListOrdered className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                        <p>
                          Recent trades will be implemented in a future update
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="shadow-md border-none">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Trading Panel</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={sidebarView === "form" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSidebarView("form")}
                      className="h-8"
                    >
                      Order
                    </Button>
                    <Button
                      variant={sidebarView === "orders" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSidebarView("orders")}
                      className="h-8"
                    >
                      Positions
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {sidebarView === "form"
                    ? "Place a new market or limit order"
                    : "Manage your open positions"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {sidebarView === "form" ? (
                  <OrderForm symbol={selectedSymbol} />
                ) : (
                  <OrderList symbol={selectedSymbol} />
                )}
              </CardContent>
            </Card>

            {/* WebSocket Debug Panel - Press Ctrl+Shift+D to toggle */}
            {showDebug && (
              <Card className="shadow-md border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Debug Panel</CardTitle>
                  <CardDescription>
                    WebSocket connection details
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <WebSocketDebug />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="mt-6">
          <div
            className="flex items-center justify-between cursor-pointer p-4 bg-card rounded-lg shadow-sm mb-4"
            onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
          >
            <div className="flex items-center gap-2">
              <BarChart4 className="h-5 w-5" />
              <Typography variant="h2" className="text-xl font-semibold">
                Trading Analytics
              </Typography>
            </div>
            <Button variant="ghost" size="icon">
              {isAnalyticsExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              isAnalyticsExpanded
                ? "max-h-[2000px] opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <Card className="shadow-md border-none">
              <CardContent className="p-4">
                <TradingAnalytics />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
