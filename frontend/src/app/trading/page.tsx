"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/trading/PriceChart";
import { MarketTicker } from "@/components/trading/MarketTicker";
import { SymbolSelector } from "@/components/trading/SymbolSelector";
import { OrderForm } from "@/components/trading/OrderForm";
import { OrderList } from "@/components/trading/OrderList";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { WebSocketDebugPanel } from "@/components/trading/WebSocketDebugPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { useWebSocket } from "@/services/websocket";
import { Toaster } from "sonner";
import { DEFAULT_SYMBOLS } from "@/config";
import { fetchSymbols } from "@/services/marketData";
import { TradingAnalytics } from "@/components/trading/TradingAnalytics";
import { Button } from "@/components/ui/button";
import {
  BarChart4,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Wallet,
  LockKeyhole,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import { useAuthStore } from "@/store/use-auth-store";
import Link from "next/link";

// Create a wrapper component to handle search params
function TradingPageContent() {
  const searchParams = useSearchParams();

  // Get symbol from URL or use default
  const symbolParam = searchParams.get("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    DEFAULT_SYMBOLS[0]
  );

  // State for active tab and UI controls
  const [showDebug, setShowDebug] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [sidebarView, setSidebarView] = useState<"orders" | "form">("form");
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // User balance state
  const {
    total,
    available,
    isLoading: balanceLoading,
    fetchBalance,
  } = useBalanceStore();
  const { isAuthenticated } = useAuthStore();

  // Set up balance synchronization with WebSocket
  useBalanceSync();

  // Reset to form view if user logs out
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

          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            {/* User Balance Display */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-1.5 rounded-md">
                <Wallet className="h-4 w-4" />
                {balanceLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <div className="flex flex-col">
                    <span className="font-medium">{formatCurrency(total)}</span>
                    <span className="text-xs text-muted-foreground">
                      Available: {formatCurrency(available)}
                    </span>
                  </div>
                )}
              </div>
            ) : null}

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

        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="text-xs"
          >
            {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
          </Button>
        </div>

        {/* Main trading interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Market ticker at the top */}
            <MarketTicker symbol={selectedSymbol} />

            {/* Chart and data tabs */}
            <Card className="overflow-hidden border-none shadow-md">
              <CardHeader className="pb-0">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl">
                    {selectedSymbol.toUpperCase()} Chart
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <PriceChart
                  symbol={selectedSymbol}
                  height={500}
                  useMockData={false} // Use real data from backend
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-2 w-full md:w-96 lg:w-[400px]">
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
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {sidebarView === "form" ? (
                  <OrderForm symbol={selectedSymbol} />
                ) : isAuthenticated ? (
                  <OrderList symbol={selectedSymbol} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <LockKeyhole className="h-12 w-12 text-indigo-400/40 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Authentication Required
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      You need to be logged in to view and manage your
                      positions.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        asChild
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Link href="/login">Login</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="border-slate-700 hover:bg-slate-800"
                      >
                        <Link href="/register">Register</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* WebSocket Debug Panel */}
            {showDebugPanel && (
              <div className="mt-4">
                <WebSocketDebugPanel className="h-[500px]" />
              </div>
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

// Loading fallback
function TradingPageSkeleton() {
  return (
    <div className="container mx-auto py-4 px-4 max-w-7xl">
      <div className="flex flex-col space-y-4">
        <div className="bg-card p-4 rounded-lg shadow-sm">
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Skeleton className="h-[600px] w-full" />
          </div>
          <div>
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
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
