import { useState, useEffect } from "react";
import { useWebSocketStore } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  createOrder,
  OrderSide,
  OrderType as OrderTypeValue,
} from "@/services/orders";
import { DEFAULT_ORDER_QUANTITY } from "@/config";

interface OrderFormProps {
  symbol: string;
  className?: string;
}

export function OrderForm({ symbol, className = "" }: OrderFormProps) {
  const { tickerData } = useWebSocketStore();

  // Order form state
  const [orderSide, setOrderSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState<string>(
    DEFAULT_ORDER_QUANTITY.toString()
  );
  const [price, setPrice] = useState<string>("");
  const [orderType, setOrderType] = useState<OrderTypeValue>("market");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Get current price from WebSocket
  const currentPrice = tickerData[symbol.toLowerCase()]?.price || 0;
  const formattedPrice = currentPrice.toFixed(2);

  // Update price field when current price changes
  useEffect(() => {
    if (currentPrice && orderType === "market") {
      setPrice(formattedPrice);
    }
  }, [currentPrice, formattedPrice, orderType]);

  // Calculate total order value
  const calculateTotal = (): number => {
    const priceValue = parseFloat(price) || 0;
    const quantityValue = parseFloat(quantity) || 0;
    return priceValue * quantityValue;
  };

  // Handle order submission
  const handleSubmitOrder = async () => {
    try {
      setIsSubmitting(true);

      // Validate inputs
      if (!quantity || parseFloat(quantity) <= 0) {
        toast.error("Invalid quantity", {
          description: "Please enter a valid quantity greater than 0",
        });
        return;
      }

      if (orderType === "limit" && (!price || parseFloat(price) <= 0)) {
        toast.error("Invalid price", {
          description: "Please enter a valid price greater than 0",
        });
        return;
      }

      // Prepare order data
      const orderData = {
        symbol: symbol.toLowerCase(),
        quantity: parseFloat(quantity),
        price: orderType === "limit" ? parseFloat(price) : undefined,
        side: orderSide,
        type: orderType,
      };

      // Send order to API using the service
      await createOrder(orderData);

      // Reset form
      setQuantity(DEFAULT_ORDER_QUANTITY.toString());
      if (orderType === "limit") {
        setPrice("");
      }

      // Show success message
      toast.success("Order placed successfully", {
        description: `${orderSide.toUpperCase()} ${quantity} ${symbol
          .slice(0, -4)
          .toUpperCase()} at ${
          orderType === "market" ? "market price" : `$${price}`
        }`,
      });
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg font-medium">Place Order</CardTitle>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Order side selector */}
          <Tabs
            value={orderSide}
            onValueChange={(value) => setOrderSide(value as OrderSide)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="flex items-center gap-1">
                <ArrowUp className="h-4 w-4" />
                Buy
              </TabsTrigger>
              <TabsTrigger value="sell" className="flex items-center gap-1">
                <ArrowDown className="h-4 w-4" />
                Sell
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Market/Limit switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="market-order">Market Order</Label>
            <Switch
              id="market-order"
              checked={orderType === "market"}
              onCheckedChange={(checked) =>
                setOrderType(checked ? "market" : "limit")
              }
            />
          </div>

          {/* Price input */}
          <div className="space-y-2">
            <Label htmlFor="price">
              Price ({symbol.slice(-4).toUpperCase()})
            </Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === "market"}
              placeholder={
                orderType === "market" ? formattedPrice : "Enter price"
              }
            />
          </div>

          {/* Quantity input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity ({symbol.slice(0, -4).toUpperCase()})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.001"
              min="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Total */}
          <div className="flex justify-between items-center py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="font-medium">
              {calculateTotal().toFixed(2)} {symbol.slice(-4).toUpperCase()}
            </span>
          </div>

          {/* Submit button */}
          <Button
            className="w-full"
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
            variant={orderSide === "buy" ? "default" : "destructive"}
          >
            {isSubmitting
              ? "Processing..."
              : `${
                  orderSide === "buy" ? "Buy" : "Sell"
                } ${symbol.toUpperCase()}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
