import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  fetchOrders,
  cancelOrder,
  Order as OrderType,
  OrderSide,
} from "@/services/orders";
import { ORDER_POLLING_INTERVAL_MS } from "@/config";

interface OrderListProps {
  symbol?: string;
  className?: string;
}

export function OrderList({ symbol, className = "" }: OrderListProps) {
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch orders from service
      const allOrders = await fetchOrders();

      // Filter by symbol if provided
      const filteredOrders = symbol
        ? allOrders.filter(
            (order) => order.symbol.toLowerCase() === symbol.toLowerCase()
          )
        : allOrders;

      // Filter to only show open orders
      const openOrders = filteredOrders.filter(
        (order) => order.status === "open"
      );

      setOrders(openOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch orders"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);

      // Remove order from list
      setOrders(orders.filter((order) => order.id !== orderId));

      // Show success message
      toast.success("Order cancelled", {
        description: "Your order has been cancelled successfully.",
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Format price
  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  // Load orders on mount and when symbol changes
  useEffect(() => {
    loadOrders();

    // Set up polling for order updates
    const intervalId = setInterval(loadOrders, ORDER_POLLING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [symbol]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Open Orders</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadOrders}
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
        ) : error ? (
          <div className="flex items-center justify-center h-[200px] text-destructive">
            {error}
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
                        {order.symbol.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          order.side === "buy"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {order.side.toUpperCase()} {order.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCancelOrder(order.id)}
                    className="h-6 w-6"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span>
                      ${order.price ? formatPrice(order.price) : "Market"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span>{order.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
