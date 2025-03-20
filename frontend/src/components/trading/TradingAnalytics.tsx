"use client";

import { useEffect, useState } from "react";
import { useAnalyticsStore } from "@/store/use-analytics-store";
import { useOrdersStore } from "@/store/use-orders-store";
import { useAuthStore } from "@/store/use-auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock,
  BarChart3,
  CircleDollarSign,
  FileClock,
  Coins,
  LockKeyhole,
  X,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Order } from "@/services/orders";
import { Trade } from "@/services/analytics";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function TradingAnalytics() {
  // Get authentication state
  const { isAuthenticated } = useAuthStore();

  // Fetch trade history data from analytics store
  const {
    tradeHistory,
    pagination,
    isLoading: analyticsIsLoading,
    fetchTradeHistory,
    setPage,
  } = useAnalyticsStore();

  // Fetch open orders data from orders store
  const {
    openOrders,
    isLoading: ordersIsLoading,
    isExiting,
    fetchOpenOrders,
    cancelOrder: cancelOrderAction,
    exitOrder: exitOrderAction,
  } = useOrdersStore();

  // State for exit order dialog
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [orderToExit, setOrderToExit] = useState<Order | null>(null);
  const [exitPrice, setExitPrice] = useState("");

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (isAuthenticated) {
      // Fetch initial data
      fetchTradeHistory();
      fetchOpenOrders();

      // Set up polling interval for open orders (refresh every 15 seconds)
      const intervalId = setInterval(() => {
        fetchOpenOrders();
      }, 15000);

      // Clean up on unmount
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, fetchTradeHistory, fetchOpenOrders]);

  // Formatter for displaying currency with appropriate decimal places
  const formatCurrency = (value: number) => {
    // For large numbers (>=1000), show 2 decimal places
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    // For medium numbers (>=1), show up to 4 decimal places
    else if (Math.abs(value) >= 1) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(value);
    }
    // For small numbers (<1), show up to 8 decimal places
    else {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }).format(value);
    }
  };

  // Formatter for quantities with appropriate decimal places
  const formatQuantity = (value: number, symbol: string) => {
    const symbolLower = symbol.toLowerCase();

    // BTC and high value coins use fewer decimals
    if (symbolLower.includes("btc")) {
      return value.toFixed(6);
    }
    // Medium value coins
    else if (symbolLower.includes("eth") || symbolLower.includes("bnb")) {
      return value.toFixed(6);
    }
    // Low value coins - more decimals
    else {
      return value.toFixed(8);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId: string) => {
    try {
      const success = await cancelOrderAction(orderId);

      if (success) {
        toast.success("Order cancelled successfully", {
          description: "Your order has been cancelled",
        });
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle opening the exit order dialog
  const handleExitOrderClick = (order: Order) => {
    setOrderToExit(order);
    // Initialize exit price with current market price if available
    // or with the order's price as fallback
    setExitPrice(order.price.toString());
    setExitDialogOpen(true);
  };

  // Handle exit order submission
  const handleExitOrderSubmit = async () => {
    if (!orderToExit || !exitPrice) return;

    try {
      const success = await exitOrderAction(
        orderToExit.id,
        parseFloat(exitPrice)
      );

      if (success) {
        // Close dialog
        setExitDialogOpen(false);
        setOrderToExit(null);
        setExitPrice("");

        // Refresh trade history as well to show new closed position
        fetchTradeHistory();

        toast.success("Order exited successfully", {
          description: "Your position has been closed",
        });
      }
    } catch (error) {
      console.error("Error exiting order:", error);
      toast.error("Failed to exit order", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Component to show when user is not logged in
  const NotAuthenticatedView = () => (
    <div className="col-span-1 lg:col-span-2 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-b from-[#131826] to-[#0F121A] p-10 border border-slate-800/40 rounded-xl">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <LockKeyhole className="h-16 w-16 text-indigo-400/40" />
          <h3 className="text-xl font-medium text-white">
            Authentication Required
          </h3>
          <p className="text-slate-400 max-w-md">
            You need to be logged in to view your trading activity and history.
          </p>
          <div className="flex space-x-4 mt-4">
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link href="/login">Login</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-600/5 to-blue-600/5 rounded-lg p-4 border border-indigo-600/10">
        <h2 className="text-xl font-bold flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-indigo-500" />
          Trading Activity
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!isAuthenticated ? (
          <NotAuthenticatedView />
        ) : (
          <>
            {/* Open Orders Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-b from-[#131826] to-[#0F121A] rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-800/40 pb-3 flex flex-row justify-between items-center">
                <CardTitle className="text-base font-medium flex items-center text-white">
                  <FileClock className="h-4 w-4 mr-2 text-indigo-400" />
                  Open Orders
                </CardTitle>
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  {openOrders.length} Active
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {ordersIsLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-slate-800/60">
                          <TableHead className="text-slate-400 font-medium">
                            Symbol
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium">
                            Type
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium">
                            Price
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium">
                            Quantity
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium">
                            Total
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium w-[100px]">
                            Created
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium w-[70px] text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openOrders.length === 0 ? (
                          <TableRow className="hover:bg-slate-800/10 border-slate-800/40">
                            <TableCell
                              colSpan={7}
                              className="text-center py-10 text-slate-500"
                            >
                              <div className="flex flex-col items-center">
                                <CircleDollarSign className="h-10 w-10 text-slate-700/50 mb-3" />
                                <p className="font-medium text-slate-400 mb-1">
                                  No open orders
                                </p>
                                <p className="text-xs text-slate-500">
                                  Your active orders will appear here
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          openOrders.map((order: Order) => (
                            <TableRow
                              key={order.id}
                              className="hover:bg-slate-800/10 border-slate-800/40"
                            >
                              <TableCell className="font-medium text-slate-300">
                                {order.symbolId}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.type === "BUY"
                                      ? "default"
                                      : "destructive"
                                  }
                                  className={cn(
                                    "px-2 py-0.5 text-xs font-medium",
                                    order.type === "BUY"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  )}
                                >
                                  {order.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-slate-300">
                                {formatCurrency(order.price)}
                              </TableCell>
                              <TableCell className="font-mono text-slate-300">
                                {formatQuantity(order.quantity, order.symbolId)}
                              </TableCell>
                              <TableCell className="font-mono text-slate-300">
                                {formatCurrency(order.price * order.quantity)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center text-xs text-slate-400">
                                  <Clock className="h-3 w-3 mr-1 opacity-70" />
                                  {format(
                                    new Date(order.createdAt),
                                    "HH:mm:ss"
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleExitOrderClick(order)}
                                  className="h-7 w-7 text-slate-400 hover:text-emerald-400"
                                  title="Close position"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-400"
                                  title="Cancel order"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
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

            {/* Exit Order Dialog */}
            <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
              <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                  <DialogTitle>Close Position</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Enter the exit price to close this position and calculate
                    profit/loss.
                  </DialogDescription>
                </DialogHeader>

                {orderToExit && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Symbol:</span>
                        <span className="font-medium">
                          {orderToExit.symbolId}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Side:</span>
                        <Badge
                          variant={
                            orderToExit.type === "BUY"
                              ? "default"
                              : "destructive"
                          }
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium",
                            orderToExit.type === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}
                        >
                          {orderToExit.type}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Entry Price:</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(orderToExit.price)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Quantity:</span>
                        <span className="font-mono font-medium">
                          {formatQuantity(
                            orderToExit.quantity,
                            orderToExit.symbolId
                          )}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-slate-800">
                        <label className="text-sm text-white mb-2 block font-medium">
                          Exit Price
                        </label>
                        <Input
                          id="exit-price"
                          type="number"
                          step="0.01"
                          value={exitPrice}
                          onChange={(e) => setExitPrice(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>

                      {/* Estimated PnL calculation */}
                      {exitPrice && (
                        <div className="mt-4 p-3 bg-slate-800/50 rounded-md">
                          <h4 className="text-xs text-slate-400 mb-2">
                            Estimated Profit/Loss
                          </h4>
                          <div className="text-lg font-mono font-medium">
                            {(() => {
                              const entryPrice = orderToExit.price;
                              const exitPriceNum = parseFloat(exitPrice);
                              if (isNaN(exitPriceNum)) return "-";

                              let pnl = 0;
                              if (orderToExit.type === "BUY") {
                                // Long position
                                pnl =
                                  (exitPriceNum - entryPrice) *
                                  orderToExit.quantity;
                              } else {
                                // Short position
                                pnl =
                                  (entryPrice - exitPriceNum) *
                                  orderToExit.quantity;
                              }

                              return (
                                <span
                                  className={
                                    pnl >= 0
                                      ? "text-emerald-400"
                                      : "text-rose-400"
                                  }
                                >
                                  {formatCurrency(pnl)}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setExitDialogOpen(false)}
                    className="text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExitOrderSubmit}
                    disabled={isExiting || !exitPrice}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isExiting ? "Closing..." : "Close Position"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Trade History Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-b from-[#131826] to-[#0F121A] rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-800/40 pb-3 flex flex-row justify-between items-center">
                <CardTitle className="text-base font-medium flex items-center text-white">
                  <Coins className="h-4 w-4 mr-2 text-indigo-400" />
                  Trade History
                </CardTitle>
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  {pagination ? pagination.total : 0} Trades
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {analyticsIsLoading.tradeHistory ? (
                  <div className="p-6">
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-900/50">
                          <TableRow className="hover:bg-transparent border-slate-800/60">
                            <TableHead className="text-slate-400 font-medium">
                              Symbol
                            </TableHead>
                            <TableHead className="text-slate-400 font-medium">
                              Side
                            </TableHead>
                            <TableHead className="text-slate-400 font-medium">
                              Price
                            </TableHead>
                            <TableHead className="text-slate-400 font-medium">
                              Quantity
                            </TableHead>
                            <TableHead className="text-slate-400 font-medium">
                              P&L
                            </TableHead>
                            <TableHead className="text-slate-400 font-medium w-[120px]">
                              Date & Time
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tradeHistory.length === 0 ? (
                            <TableRow className="hover:bg-slate-800/10 border-slate-800/40">
                              <TableCell
                                colSpan={6}
                                className="text-center py-10 text-slate-500"
                              >
                                <div className="flex flex-col items-center">
                                  <CircleDollarSign className="h-10 w-10 text-slate-700/50 mb-3" />
                                  <p className="font-medium text-slate-400 mb-1">
                                    No trade history
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Your completed trades will appear here
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            tradeHistory.map((trade: Trade) => (
                              <TableRow
                                key={trade.id}
                                className="hover:bg-slate-800/10 border-slate-800/40"
                              >
                                <TableCell className="font-medium text-slate-300">
                                  {trade.symbolName}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      (trade.type || trade.side) === "BUY"
                                        ? "default"
                                        : "destructive"
                                    }
                                    className={cn(
                                      "px-2 py-0.5 text-xs font-medium",
                                      (trade.type || trade.side) === "BUY"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    )}
                                  >
                                    {trade.type || trade.side}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-slate-300">
                                  {formatCurrency(trade.price)}
                                </TableCell>
                                <TableCell className="font-mono text-slate-300">
                                  {formatQuantity(
                                    trade.quantity,
                                    trade.symbolName
                                  )}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "font-mono",
                                    trade.pnl !== null && trade.pnl > 0
                                      ? "text-emerald-400"
                                      : trade.pnl !== null && trade.pnl < 0
                                      ? "text-rose-400"
                                      : "text-slate-300"
                                  )}
                                >
                                  {trade.pnl !== null
                                    ? formatCurrency(trade.pnl)
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-slate-400">
                                  {format(
                                    new Date(
                                      trade.timestamp ||
                                        trade.createdAt ||
                                        new Date()
                                    ),
                                    "MMM dd, HH:mm"
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {pagination && pagination.pages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-800/40 bg-slate-900/20">
                        <div className="text-xs text-slate-400">
                          <span className="font-medium text-slate-300">
                            {pagination.total}
                          </span>{" "}
                          total trades
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 border-slate-700 bg-slate-800/30 hover:bg-slate-800 text-slate-300"
                            onClick={() =>
                              setPage(Math.max(1, pagination.currentPage - 1))
                            }
                            disabled={pagination.currentPage <= 1}
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                          </Button>
                          <div className="text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded border border-slate-700 min-w-[80px] text-center">
                            Page {pagination.currentPage} of {pagination.pages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 border-slate-700 bg-slate-800/30 hover:bg-slate-800 text-slate-300"
                            onClick={() =>
                              setPage(
                                Math.min(
                                  pagination.pages,
                                  pagination.currentPage + 1
                                )
                              )
                            }
                            disabled={
                              pagination.currentPage >= pagination.pages
                            }
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
