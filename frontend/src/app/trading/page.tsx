"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/trading/PriceChart";
import { MarketTicker } from "@/components/trading/MarketTicker";
import { SymbolSelector } from "@/components/trading/SymbolSelector";
import { OrderForm } from "@/components/trading/OrderForm";
import { OrderList } from "@/components/trading/OrderList";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";
import { useWebSocketStore } from "@/services/websocket";
import { Toaster } from "sonner";
import { DEFAULT_SYMBOLS } from "@/config";

export default function TradingPage() {
  const searchParams = useSearchParams();
  const { connect } = useWebSocketStore();

  // Get symbol from URL or use default
  const symbolParam = searchParams.get("symbol");
  const selectedSymbol = symbolParam?.toLowerCase() || DEFAULT_SYMBOLS[0];

  // State for active tab
  const [activeTab, setActiveTab] = useState("chart");

  // Ensure WebSocket connection is established
  useEffect(() => {
    connect();
  }, [connect]);

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
          </div>
        </div>
      </div>
    </main>
  );
}
