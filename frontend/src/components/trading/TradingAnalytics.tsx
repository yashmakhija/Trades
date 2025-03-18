"use client";

import { useEffect, useState } from "react";
import { useAnalyticsStore } from "@/store/use-analytics-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export function TradingAnalytics() {
  const {
    userStats,
    symbolStats,
    dailyPnL,
    tradeHistory,
    pagination,
    dateRange,
    isLoading,
    fetchAllData,
    setDateRange,
    setPage,
    setSelectedSymbolId,
  } = useAnalyticsStore();

  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange({
      startDate: range.from,
      endDate: range.to,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trading Analytics</h2>
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {dateRange.startDate
                    ? format(dateRange.startDate, "MMM dd, yyyy")
                    : "Start date"}{" "}
                  -
                  {dateRange.endDate
                    ? format(dateRange.endDate, "MMM dd, yyyy")
                    : "End date"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange.startDate || undefined,
                  to: dateRange.endDate || undefined,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    handleDateRangeChange(range as { from: Date; to: Date });
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pnl">P&L Analysis</TabsTrigger>
          <TabsTrigger value="symbols">Symbol Performance</TabsTrigger>
          <TabsTrigger value="history">Trade History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading.userStats ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-3/4" />
                    </CardContent>
                  </Card>
                ))
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total P&L
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userStats ? formatCurrency(userStats.totalPnL) : "$0.00"}
                      <span
                        className={cn(
                          "ml-2 text-sm",
                          userStats && userStats.totalPnL > 0
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        {userStats && userStats.totalPnL > 0 ? (
                          <ArrowUpIcon className="inline h-4 w-4" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4" />
                        )}
                        {userStats ? formatPercentage(userStats.winRate) : "0%"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Win Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userStats ? formatPercentage(userStats.winRate) : "0%"}
                      <span className="ml-2 text-sm text-muted-foreground">
                        {userStats
                          ? `${userStats.profitableTrades}/${userStats.totalTrades} trades`
                          : "0/0 trades"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Avg. Trade
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userStats
                        ? formatCurrency(userStats.averagePnL)
                        : "$0.00"}
                      <span className="ml-2 text-sm text-muted-foreground">
                        per trade
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily P&L</CardTitle>
              <CardDescription>Your profit and loss over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading.dailyPnL ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={dailyPnL.map((day) => ({
                      date: format(new Date(day.date), "MMM dd"),
                      pnl: day.pnl,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "P&L",
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="pnl"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily P&L Breakdown</CardTitle>
              <CardDescription>
                Your profit and loss for each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading.dailyPnL ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={dailyPnL.map((day) => ({
                      date: format(new Date(day.date), "MMM dd"),
                      pnl: day.pnl,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "P&L",
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Bar
                      dataKey="pnl"
                      // @ts-expect-error - recharts typing issue with dynamic fill colors
                      fill={(entry) => (entry.pnl >= 0 ? "#4ade80" : "#f87171")}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="symbols" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Symbol Performance</CardTitle>
              <CardDescription>
                Performance breakdown by trading symbol
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading.symbolStats ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Trades</TableHead>
                        <TableHead>Win Rate</TableHead>
                        <TableHead>P&L</TableHead>
                        <TableHead>Avg. Trade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {symbolStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">
                            No symbol data available for the selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        symbolStats.map((symbol) => (
                          <TableRow
                            key={symbol.symbol}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedSymbolId(symbol.symbol)}
                          >
                            <TableCell className="font-medium">
                              {symbol.symbol}
                            </TableCell>
                            <TableCell>{symbol.totalTrades}</TableCell>
                            <TableCell>
                              {formatPercentage(symbol.winRate)}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({symbol.profitableTrades}/{symbol.totalTrades})
                              </span>
                            </TableCell>
                            <TableCell
                              className={cn(
                                symbol.totalPnL > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              )}
                            >
                              {formatCurrency(symbol.totalPnL)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(symbol.averagePnL)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
              <CardDescription>
                Your recent trades
                {pagination && ` (${pagination.total} total)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading.tradeHistory ? (
                <Skeleton className="h-[400px] w-full" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>P&L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tradeHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              No trades available for the selected period
                            </TableCell>
                          </TableRow>
                        ) : (
                          tradeHistory.map((trade) => (
                            <TableRow key={trade.id}>
                              <TableCell>
                                {format(
                                  new Date(trade.createdAt),
                                  "MMM dd, yyyy HH:mm:ss"
                                )}
                              </TableCell>
                              <TableCell>{trade.symbolName}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    trade.type === "BUY"
                                      ? "default"
                                      : "destructive"
                                  }
                                >
                                  {trade.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {formatCurrency(trade.price)}
                              </TableCell>
                              <TableCell>{trade.quantity}</TableCell>
                              <TableCell
                                className={cn(
                                  trade.pnl !== null && trade.pnl > 0
                                    ? "text-green-500"
                                    : trade.pnl !== null && trade.pnl < 0
                                    ? "text-red-500"
                                    : ""
                                )}
                              >
                                {trade.pnl !== null
                                  ? formatCurrency(trade.pnl)
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage(Math.max(1, pagination.currentPage - 1))
                        }
                        disabled={pagination.currentPage <= 1}
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {pagination.currentPage} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage(
                            Math.min(
                              pagination.pages,
                              pagination.currentPage + 1
                            )
                          )
                        }
                        disabled={pagination.currentPage >= pagination.pages}
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
