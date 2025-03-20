import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, X, DollarSign } from "lucide-react";
import { Order as OrderType } from "@/services/orders";
import { ORDER_POLLING_INTERVAL_MS } from "@/config";
import { useOrdersStore } from "@/store/use-orders-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrderListProps {
  symbol?: string;
  className?: string;
}

export function OrderList({ symbol, className = "" }: OrderListProps) {
  // Order exit dialog state
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [orderToExit, setOrderToExit] = useState<OrderType | null>(null);
  const [exitPrice, setExitPrice] = useState("");

  // Use orders store for state management
  const {
    openOrders: allOpenOrders,
    isLoading,
    isExiting,
    fetchOpenOrders,
    cancelOrder: cancelOrderAction,
    exitOrder: exitOrderAction,
  } = useOrdersStore();

  // Filter orders by symbol if provided
  const orders = symbol
    ? allOpenOrders.filter(
        (order) => order.symbolId.toLowerCase() === symbol.toLowerCase()
      )
    : allOpenOrders;

  // Handle order cancellation
  const handleCancelOrder = async (orderId: string) => {
    try {
      const success = await cancelOrderAction(orderId);

      if (success) {
        toast.success("Order cancelled", {
          description: "Your order has been cancelled successfully.",
        });
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Handle opening the exit order dialog
  const handleExitOrderClick = (order: OrderType) => {
    setOrderToExit(order);
    // Initialize exit price with the order's price as fallback
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

  // Format currency with appropriate decimal places
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

  // Load orders on mount and when symbol changes
  useEffect(() => {
    fetchOpenOrders();

    // Set up polling for order updates
    const intervalId = setInterval(fetchOpenOrders, ORDER_POLLING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchOpenOrders]);

  return (
    <>
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-medium">Open Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchOpenOrders}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          {isLoading && orders.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No open orders
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col p-3 border rounded-md bg-card"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {order.symbolId.toUpperCase()}
                        </span>
                        <Badge
                          variant={
                            order.type === "BUY" ? "default" : "destructive"
                          }
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium",
                            order.type === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}
                        >
                          {order.type} {order.isShort ? "SHORT" : ""}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleExitOrderClick(order)}
                        className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                        title="Close position"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelOrder(order.id)}
                        className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                        title="Cancel order"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price:</span>
                      <span>{formatCurrency(order.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span>
                        {formatQuantity(order.quantity, order.symbolId)}
                      </span>
                    </div>
                    {order.stopLoss && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Stop Loss:
                        </span>
                        <span>{formatCurrency(order.stopLoss)}</span>
                      </div>
                    )}
                    {order.takeProfit && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Take Profit:
                        </span>
                        <span>{formatCurrency(order.takeProfit)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                  <span className="font-medium">{orderToExit.symbolId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Side:</span>
                  <Badge
                    variant={
                      orderToExit.type === "BUY" ? "default" : "destructive"
                    }
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium",
                      orderToExit.type === "BUY"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}
                  >
                    {orderToExit.type} {orderToExit.isShort ? "SHORT" : ""}
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
                    {formatQuantity(orderToExit.quantity, orderToExit.symbolId)}
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
                            (exitPriceNum - entryPrice) * orderToExit.quantity;
                        } else {
                          // Short position
                          pnl =
                            (entryPrice - exitPriceNum) * orderToExit.quantity;
                        }

                        return (
                          <span
                            className={
                              pnl >= 0 ? "text-emerald-400" : "text-rose-400"
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
    </>
  );
}
