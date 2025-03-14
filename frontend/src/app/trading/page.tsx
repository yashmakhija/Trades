"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PriceChart } from "@/components/trading/PriceChart";
import { MarketTicker } from "@/components/trading/MarketTicker";
import { SymbolSelector } from "@/components/trading/SymbolSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Typography } from "@/components/ui/typography";

export default function TradingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get symbol from URL or use default
  const symbolParam = searchParams.get("symbol");

  // State for selected symbol
  const [selectedSymbol, setSelectedSymbol] = useState(
    symbolParam?.toLowerCase() || "btcusdt"
  );

  // State for active tab
  const [activeTab, setActiveTab] = useState("chart");

  // Update symbol when URL parameter changes
  useEffect(() => {
    if (symbolParam) {
      setSelectedSymbol(symbolParam.toLowerCase());
    }
  }, [symbolParam]);

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);

    // Update URL with new symbol
    router.push(`/trading?symbol=${symbol}`);
  };

  return (
    <main className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Typography variant="h1" className="text-2xl font-bold">
            Trading Dashboard
          </Typography>

          <div className="w-full md:w-64">
            <SymbolSelector
              value={selectedSymbol}
              onValueChange={handleSymbolChange}
            />
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
                  useMockData={true} // Use mock data until backend is connected
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

            <Card>
              <CardHeader>
                <CardTitle>Place Order</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Order form will be implemented in a future update
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No open orders
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
