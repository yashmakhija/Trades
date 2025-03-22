"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/trading/PriceChart";
// import { OrderForm } from "@/components/trading/OrderForm";
import { Card, CardContent } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { useWebSocket } from "@/services/websocket";
import { Toaster } from "sonner";
import { DEFAULT_SYMBOLS } from "@/config";
import { fetchSymbols } from "@/services/marketData";
import { TradingAnalytics } from "@/components/trading/TradingAnalytics";
import { BarChart4, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useWebSocketMarketSync } from "@/services/websocket-sync";
import { MarketSidebar } from "@/components/trading/MarketSidebar";

function TradingPageContent() {
  const searchParams = useSearchParams();

  const symbolParam = searchParams.get("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    DEFAULT_SYMBOLS[0]
  );

  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [sidebarView, setSidebarView] = useState<"orders" | "form">("form");
  // const [showDebugPanel, setShowDebugPanel] = useState(false);

  const {
    // total,
    // available,
    // isLoading: balanceLoading,
    fetchBalance,
  } = useBalanceStore();
  const { isAuthenticated } = useAuthStore();

  useBalanceSync();

  useWebSocketMarketSync();

  useEffect(() => {
    if (!isAuthenticated && sidebarView === "orders") {
      setSidebarView("form");
    }
  }, [isAuthenticated, sidebarView]);

  // Use the WebSocket hook
  const {
    connect,
    setActiveSymbol,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    activeSymbol,
    connectionState,
  } = useWebSocket();

  // Load symbols and resolve symbol ID to name if needed
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const symbols = await fetchSymbols();

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

  // Ensure WebSocket connection is established once on component mount
  useEffect(() => {
    console.log("TradingPage: Initializing WebSocket connection");
    connect();
  }, [connect]);

  // Fetch balance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log("Trading page: User is authenticated, fetching balance...");
      fetchBalance();
    } else {
      console.log(
        "Trading page: User is not authenticated, skipping balance fetch"
      );
    }
  }, [isAuthenticated, fetchBalance]);

  // Handle symbol changes and ensure proper subscription
  useEffect(() => {
    if (!selectedSymbol) return;

    console.log(`TradingPage: Symbol changed to ${selectedSymbol}`);

    // Only handle subscription changes when the connection is established
    if (connectionState === "connected") {
      // If there's a different active symbol, unsubscribe from it first
      if (activeSymbol && activeSymbol !== selectedSymbol) {
        console.log(
          `TradingPage: Unsubscribing from previous symbol ${activeSymbol}`
        );
        unsubscribeFromSymbol(activeSymbol);
      }

      // Set the new symbol as active
      setActiveSymbol(selectedSymbol);

      // Subscribe to the new symbol
      console.log(`TradingPage: Subscribing to symbol ${selectedSymbol}`);
      subscribeToSymbol(selectedSymbol);
    }
  }, [
    selectedSymbol,
    connectionState,
    activeSymbol,
    setActiveSymbol,
    subscribeToSymbol,
    unsubscribeFromSymbol,
  ]);

  // Toggle debug panel with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        // setShowDebugPanel((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="bg-card/30 ">
      <Toaster position="top-right" richColors />

      {/* <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Typography
              variant="h1"
              className="text-xl font-bold hidden sm:block"
            >
              Trading Platform
            </Typography>
            <ConnectionStatus />
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-1.5 rounded-md">
                <Wallet className="h-4 w-4" />
                {balanceLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-300">
                      {formatCurrency(total)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Available: {formatCurrency(available)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="h-8 w-8"
            >
              {showDebugPanel ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header> */}

      <main className="container mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="w-full lg:w-80 shrink-0 h-[calc(100vh-120px)] sticky top-[73px]">
            <MarketSidebar />
          </aside>

          <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="w-full sm:w-64 shrink-0"></div>
            </div>

            <div className="grid grid-cols-1 gap-0">
              <div className="lg:col-span-2">
                <Card className="overflow-hidden border-0 shadow-md h-full">
                  <CardContent className="p-0 h-[650px] w-full">
                    <PriceChart
                      symbol={selectedSymbol}
                      height={650}
                      useMockData={false}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* <div>
                <Card className="overflow-hidden border-0 shadow-md h-full">
                  <CardHeader className="py-3 px-4 border-b border-border/60">
                    <CardTitle className="text-lg">Order Form</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <OrderForm symbol={selectedSymbol} />
                  </CardContent>
                </Card>
              </div> */}
            </div>

            <div>
              <button
                className="flex w-full items-center justify-between p-3 bg-card rounded-lg border border-border/60 shadow-sm mb-2"
                onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
              >
                <div className="flex items-center gap-2">
                  <BarChart4 className="h-5 w-5" />
                  <Typography variant="h2" className="text-lg font-semibold">
                    Trading Analytics
                  </Typography>
                </div>
                {isAnalyticsExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>

              <div
                className={cn(
                  "transition-all duration-300 ease-in-out overflow-hidden rounded-lg",
                  isAnalyticsExpanded
                    ? "max-h-[2000px] opacity-100"
                    : "max-h-0 opacity-0"
                )}
              >
                <Card className="shadow-md border-0">
                  <CardContent className="p-4">
                    <TradingAnalytics />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Loading fallback
function TradingPageSkeleton() {
  return (
    <div className="bg-card/30 min-h-screen">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="w-full lg:w-80">
            <Skeleton className="h-[calc(100vh-120px)] w-full" />
          </aside>

          <div className="flex-1 space-y-4">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Skeleton className="h-[450px] w-full" />
              </div>
              <div>
                <Skeleton className="h-[450px] w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Export the Trading Page with Suspense boundary
export default function TradingPage() {
  return (
    <Suspense fallback={<TradingPageSkeleton />}>
      <TradingPageContent />
    </Suspense>
  );
}
