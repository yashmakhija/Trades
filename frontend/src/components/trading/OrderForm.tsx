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
import { useAuthStore } from "@/store/use-auth-store";
import Link from "next/link";
import { LockKeyhole, ArrowRight, ShieldAlert } from "lucide-react";

interface OrderFormProps {
  symbol: string;
  className?: string;
}

export function OrderForm({ symbol, className = "" }: OrderFormProps) {
  const { tickerData } = useWebSocketStore();
  const { symbols, setSymbols } = useSymbolStore();
  const { user } = useAuthStore();

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
      if (!user) {
        toast.error("Authentication required", {
          description: "Please log in to place orders",
        });
        return;
      }

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

  // If user is not logged in, show login prompt with improved design
  if (!user) {
    return (
      <Card className={`overflow-hidden shadow-md border-0 ${className}`}>
        {/* Card header with improved styling */}
        <CardHeader className="p-4 pb-2 border-b border-slate-800/40 bg-gradient-to-r from-blue-950/30 to-indigo-950/30">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Authentication Required
          </CardTitle>
        </CardHeader>

        {/* Content with price display to show user what they're missing */}
        <CardContent className="p-0">
          {/* Current price display */}
          <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/10 border-b border-slate-800/30 p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400">Current Price</div>
                <div className="text-xl font-bold font-mono text-white">
                  {currentPrice > 0 ? formattedPrice : "-.--"} USD
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Trading</div>
                <div className="text-lg font-semibold text-indigo-400">
                  {symbol.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Login container */}
          <div className="bg-gradient-to-b from-slate-900/50 to-slate-950/50 p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3 border border-indigo-500/20">
              <LockKeyhole className="h-8 w-8 text-indigo-400" />
            </div>

            <h3 className="text-lg font-medium text-white mb-2">
              Login to Start Trading
            </h3>

            <p className="text-slate-400 text-sm mb-6 max-w-sm">
              Create an account or sign in to access full trading features,
              including placing orders and tracking your positions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <Link
                href="/login"
                className="bg-slate-800 hover:bg-slate-700 text-white shadow-lg hover:shadow-indigo-900/20 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-10 px-4 py-2 w-full border border-slate-700"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-indigo-900/30 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-10 px-4 py-2 w-full"
              >
                <span className="flex items-center">
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </Link>
            </div>

            {/* Demo trading features */}
            <div className="w-full mt-6 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 bg-slate-800/30 p-2 rounded-md">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Real-time Market Data</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 p-2 rounded-md">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Trade Multiple Assets</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 p-2 rounded-md">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Advanced Order Types</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 p-2 rounded-md">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Portfolio Analytics</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
