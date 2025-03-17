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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import { useWebSocket } from "@/services/websocket";
import { Toaster } from "sonner";
import { DEFAULT_SYMBOLS } from "@/config";
import { fetchSymbols } from "@/services/marketData";

export default function TradingPage() {
  const searchParams = useSearchParams();

  // Get symbol from URL or use default
  const symbolParam = searchParams.get("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    DEFAULT_SYMBOLS[0]
  );

  // State for active tab
  const [activeTab, setActiveTab] = useState("chart");
  const [showDebug, setShowDebug] = useState(false);

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
    <main className="container mx-auto py-6 px-4">
      {/* Toast provider for notifications */}
      <Toaster position="top-right" richColors />

      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Typography variant="h1" className="text-2xl font-bold">
              Trading Dashboard
            </Typography>
            <ConnectionStatus />
          </div>

          <div className="w-full md:w-64">
            <SymbolSelector />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="chart">Chart</TabsTrigger>
                <TabsTrigger value="orderbook">Order Book</TabsTrigger>
                <TabsTrigger value="trades">Recent Trades</TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-4">
                <PriceChart
                  symbol={selectedSymbol}
                  height={500}
                  useMockData={false} // Use real data from backend
                />
              </TabsContent>

              <TabsContent value="orderbook" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Book</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      Order book will be implemented in a future update
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trades" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      Recent trades will be implemented in a future update
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <MarketTicker symbol={selectedSymbol} />
            <OrderForm symbol={selectedSymbol} />
            <OrderList symbol={selectedSymbol} />

            {/* WebSocket Debug Panel - Press Ctrl+Shift+D to toggle */}
            {showDebug && <WebSocketDebug />}
          </div>
        </div>
      </div>
    </main>
  );
}
