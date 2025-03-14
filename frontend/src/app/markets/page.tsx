"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWebSocketStore } from "@/services/websocket";
import { fetchSymbols, SymbolData } from "@/services/marketData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MarketsPage() {
  // State for symbols and search
  const [symbols, setSymbols] = useState<SymbolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // State for sorting
  const [sortField, setSortField] = useState<"name" | "price" | "change">(
    "name"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Get ticker data from WebSocket store
  const { tickerData, connectionState } = useWebSocketStore();

  // Load available symbols
  useEffect(() => {
    async function loadSymbols() {
      setIsLoading(true);

      try {
        const data = await fetchSymbols();

        if (data.length === 0) {
          // If no symbols from API, use default ones
          setSymbols([
            {
              id: "1",
              name: "btcusdt",
              description: "Bitcoin / USDT",
              currentPrice: null,
            },
            {
              id: "2",
              name: "ethusdt",
              description: "Ethereum / USDT",
              currentPrice: null,
            },
            {
              id: "3",
              name: "solusdt",
              description: "Solana / USDT",
              currentPrice: null,
            },
            {
              id: "4",
              name: "adausdt",
              description: "Cardano / USDT",
              currentPrice: null,
            },
          ]);
        } else {
          setSymbols(data);
        }
      } catch (error) {
        console.error("Error loading symbols:", error);

        // Fallback to default symbols
        setSymbols([
          {
            id: "1",
            name: "btcusdt",
            description: "Bitcoin / USDT",
            currentPrice: null,
          },
          {
            id: "2",
            name: "ethusdt",
            description: "Ethereum / USDT",
            currentPrice: null,
          },
          {
            id: "3",
            name: "solusdt",
            description: "Solana / USDT",
            currentPrice: null,
          },
          {
            id: "4",
            name: "adausdt",
            description: "Cardano / USDT",
            currentPrice: null,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadSymbols();
  }, []);

  // Format price with appropriate decimal places
  const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null) return "-.--";

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

  // Handle sort change
  const handleSort = (field: "name" | "price" | "change") => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort symbols
  const filteredAndSortedSymbols = symbols
    .filter((symbol) => {
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        symbol.name.toLowerCase().includes(query) ||
        symbol.description.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aTickerData = tickerData[a.name.toLowerCase()];
      const bTickerData = tickerData[b.name.toLowerCase()];

      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      if (sortField === "price") {
        const aPrice = aTickerData?.price ?? a.currentPrice ?? 0;
        const bPrice = bTickerData?.price ?? b.currentPrice ?? 0;

        return sortDirection === "asc" ? aPrice - bPrice : bPrice - aPrice;
      }

      if (sortField === "change") {
        const aChange = aTickerData?.priceChangePercent ?? 0;
        const bChange = bTickerData?.priceChangePercent ?? 0;

        return sortDirection === "asc" ? aChange - bChange : bChange - aChange;
      }

      return 0;
    });

  // Get sort icon
  const getSortIcon = (field: "name" | "price" | "change") => {
    if (field !== sortField) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  return (
    <main className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Typography variant="h1" className="text-2xl font-bold">
            Markets
          </Typography>

          <div className="w-full md:w-64 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Available Markets</CardTitle>

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
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th
                        className="text-left py-3 px-4 cursor-pointer"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center">
                          Market
                          {getSortIcon("name")}
                        </div>
                      </th>
                      <th
                        className="text-right py-3 px-4 cursor-pointer"
                        onClick={() => handleSort("price")}
                      >
                        <div className="flex items-center justify-end">
                          Price
                          {getSortIcon("price")}
                        </div>
                      </th>
                      <th
                        className="text-right py-3 px-4 cursor-pointer"
                        onClick={() => handleSort("change")}
                      >
                        <div className="flex items-center justify-end">
                          24h Change
                          {getSortIcon("change")}
                        </div>
                      </th>
                      <th className="text-right py-3 px-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAndSortedSymbols.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No markets found
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedSymbols.map((symbol) => {
                        const tickerInfo =
                          tickerData[symbol.name.toLowerCase()];
                        const price = tickerInfo?.price ?? symbol.currentPrice;
                        const priceChange = tickerInfo?.priceChangePercent ?? 0;
                        const priceChangeDirection =
                          priceChange >= 0 ? "up" : "down";

                        return (
                          <tr
                            key={symbol.id}
                            className="border-b hover:bg-secondary/20"
                          >
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {symbol.description}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {symbol.name.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="text-right py-4 px-4 font-medium">
                              ${formatPrice(price)}
                            </td>
                            <td
                              className={`text-right py-4 px-4 font-medium ${
                                priceChangeDirection === "up"
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {formatPercentChange(priceChange)}
                            </td>
                            <td className="text-right py-4 px-4">
                              <Button size="sm" asChild>
                                <Link href={`/trading?symbol=${symbol.name}`}>
                                  Trade
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
