import { useState, useEffect } from "react";
import { useWebSocketStore } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  createOrder,
  OrderSide,
  OrderType as OrderTypeValue,
} from "@/services/orders";
import { DEFAULT_ORDER_QUANTITY } from "@/config";
import { useSymbolStore, TradingSymbol } from "@/store/use-symbol-store";
import { fetchSymbols } from "@/services/symbols";

interface OrderFormProps {
  symbol: string;
  className?: string;
}

export function OrderForm({ symbol, className = "" }: OrderFormProps) {
  const { tickerData } = useWebSocketStore();
  const { symbols, setSymbols } = useSymbolStore();

  // Get symbol ID from the symbols list
  const symbolData = symbols.find(
    (s: TradingSymbol) => s.name.toLowerCase() === symbol.toLowerCase()
  );

  // Order form state
  const [orderSide, setOrderSide] = useState<OrderSide>("BUY");
  const [quantity, setQuantity] = useState<string>(
    DEFAULT_ORDER_QUANTITY.toString()
  );
  const [price, setPrice] = useState<string>("");
  const [orderType, setOrderType] = useState<OrderTypeValue>("market");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stopLoss, setStopLoss] = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");
  const [isLoadingSymbols, setIsLoadingSymbols] = useState<boolean>(true);

  // Load symbols when component mounts
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const fetchedSymbols = await fetchSymbols();
        setSymbols(fetchedSymbols);
      } catch (error) {
        console.error("Error loading symbols:", error);
        toast.error("Failed to load trading symbols");
      } finally {
        setIsLoadingSymbols(false);
      }
    };

    if (symbols.length === 0) {
      loadSymbols();
    } else {
      setIsLoadingSymbols(false);
    }
  }, [setSymbols, symbols.length]);

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
      if (!symbolData) {
        toast.error("Symbol not found", {
          description: "Unable to find symbol information",
        });
        return;
      }

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

      // Parse values as floating point
      const priceValue = parseFloat(price);
      const quantityValue = parseFloat(quantity);
      const stopLossValue = stopLoss ? parseFloat(stopLoss) : undefined;
      const takeProfitValue = takeProfit ? parseFloat(takeProfit) : undefined;

      console.log("Order values before conversion:", {
        price: priceValue,
        stopLoss: stopLossValue,
        takeProfit: takeProfitValue,
      });

      // Prepare order data
      const orderData = {
        symbolId: symbolData.id,
        type: orderSide,
        price: priceValue,
        quantity: quantityValue,
        isShort: false,
        stopLoss: stopLossValue,
        takeProfit: takeProfitValue,
      };

      // Send order to API using the service
      // The createOrder function will handle conversion to integers for the backend
      const createdOrder = await createOrder(orderData);

      console.log("Order created successfully:", createdOrder);

      // Reset form
      setQuantity(DEFAULT_ORDER_QUANTITY.toString());
      if (orderType === "limit") {
        setPrice("");
      }
      setStopLoss("");
      setTakeProfit("");

      // Show success message
      toast.success("Order placed successfully", {
        description: `${orderSide} ${quantity} ${symbol
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

      <CardContent className="p-4 pt-2">
        <div className="space-y-4">
          {/* Order type tabs */}
          <Tabs
            defaultValue="market"
            value={orderType}
            onValueChange={(value) => setOrderType(value as OrderTypeValue)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Buy/Sell switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="order-side">Order Side</Label>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="order-side"
                className={`${
                  orderSide === "SELL" ? "text-destructive" : "text-primary"
                }`}
              >
                {orderSide}
              </Label>
              <Switch
                id="order-side"
                checked={orderSide === "BUY"}
                onCheckedChange={(checked) =>
                  setOrderSide(checked ? "BUY" : "SELL")
                }
              />
            </div>
          </div>

          {/* Price input */}
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === "market"}
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

          {/* Stop Loss input */}
          <div className="space-y-2">
            <Label htmlFor="stopLoss">Stop Loss (Optional)</Label>
            <Input
              id="stopLoss"
              type="number"
              step="0.01"
              min="0.01"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Enter stop loss price"
            />
          </div>

          {/* Take Profit input */}
          <div className="space-y-2">
            <Label htmlFor="takeProfit">Take Profit (Optional)</Label>
            <Input
              id="takeProfit"
              type="number"
              step="0.01"
              min="0.01"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Enter take profit price"
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
            disabled={isSubmitting || isLoadingSymbols}
            variant={orderSide === "BUY" ? "default" : "destructive"}
          >
            {isSubmitting
              ? "Processing..."
              : `${orderSide} ${symbol.toUpperCase()}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
