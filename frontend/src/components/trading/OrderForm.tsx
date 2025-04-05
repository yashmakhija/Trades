import { useState, useEffect } from "react";
import { useWebSocketStore } from "@/services/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  createOrder,
  OrderSide,
  OrderType as OrderTypeValue,
} from "@/services/orders";
import { DEFAULT_ORDER_QUANTITY, SPREAD_FEE_PERCENTAGE } from "@/config";
import { useSymbolStore, TradingSymbol } from "@/store/use-symbol-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useBalanceStore, useBalanceSync } from "@/store/use-balance-store";
import Link from "next/link";
import { LockKeyhole, ArrowRight, ShieldAlert, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface OrderFormProps {
  symbol: string;
  className?: string;
}

export function OrderForm({ symbol, className = "" }: OrderFormProps) {
  const { tickerData } = useWebSocketStore();
  const { symbols, fetchSymbols, isLoading: symbolsLoading } = useSymbolStore();
  const { user, isAuthenticated } = useAuthStore();
  const { available, fetchBalance } = useBalanceStore();

  // Enable balance synchronization
  useBalanceSync();

  // Get symbol ID from the symbols list
  const symbolData = symbols.find(
    (s: TradingSymbol) => s.name.toLowerCase() === symbol.toLowerCase()
  );

  // Debug logging to help diagnose symbol selection issues
  useEffect(() => {
    if (symbols.length > 0) {
      console.log("Available symbols:", symbols);
      console.log("Current symbol name:", symbol);
      console.log("Selected symbol data:", symbolData);
    }
  }, [symbols.length, symbol, symbolData]);

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
  const [isLoadingSymbols, setIsLoadingSymbols] =
    useState<boolean>(symbolsLoading);

  // Fetch balance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
    }
  }, [isAuthenticated, fetchBalance]);

  // Load symbols when component mounts (only once)
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        setIsLoadingSymbols(true);
        await fetchSymbols();
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
  }, [fetchSymbols, symbols.length]);

  // Get current price from WebSocket
  const currentPrice = tickerData[symbol.toLowerCase()]?.price || 0;

  // Apply spread fee to price based on order side
  const applySpreadFee = (basePrice: number, side: OrderSide): number => {
    if (basePrice <= 0) return 0;

    // For BUY orders: increase price by spread fee percentage
    // For SELL orders: decrease price by spread fee percentage
    const spreadAmount = basePrice * SPREAD_FEE_PERCENTAGE;
    const adjustedPrice =
      side === "BUY"
        ? basePrice + spreadAmount // Higher price for buyers
        : basePrice - spreadAmount; // Lower price for sellers

    return adjustedPrice;
  };

  // Get price with spread fee applied
  const priceWithSpread = applySpreadFee(currentPrice, orderSide);
  const formattedPrice = priceWithSpread.toFixed(2);

  // Spread fee amount for display
  const spreadFeeAmount = (currentPrice * SPREAD_FEE_PERCENTAGE).toFixed(2);
  const spreadFeePercent = (SPREAD_FEE_PERCENTAGE * 100).toFixed(2);

  // Update price field when current price changes or order side changes
  useEffect(() => {
    if (currentPrice && orderType === "market") {
      setPrice(formattedPrice);
    }
  }, [currentPrice, formattedPrice, orderType, orderSide]);

  // Calculate total order value
  const calculateTotal = (): number => {
    const priceValue = parseFloat(price) || 0;
    const quantityValue = parseFloat(quantity) || 0;
    return priceValue * quantityValue;
  };

  // Check if user has enough balance
  const orderCost = calculateTotal();
  const hasEnoughBalance = available >= orderCost;

  // Handle order submission
  const handleSubmitOrder = async () => {
    try {
      if (!isAuthenticated) {
        toast.error("Authentication required", {
          description: "Please log in to place orders",
        });
        return;
      }

      // Get symbol data from the store
      let symbolData = useSymbolStore.getState().getSymbolByName(symbol);

      if (!symbolData) {
        // Try to fetch fresh symbols if not found in cache
        await useSymbolStore.getState().fetchSymbolsForce();
        symbolData = useSymbolStore.getState().getSymbolByName(symbol);

        if (!symbolData) {
          console.error("Symbol not found in available symbols:", {
            symbolToFind: symbol,
            availableSymbols: symbols.map((s) => s.name),
          });

          toast.error("Symbol not found", {
            description: "Unable to find symbol information. Please try again.",
          });
          return;
        }
      }

      // Use the symbol data for the rest of the function
      const symbolId = symbolData.id;

      if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        toast.error("Invalid price", {
          description: "Please enter a valid price",
        });
        return;
      }

      if (
        !quantity ||
        isNaN(parseFloat(quantity)) ||
        parseFloat(quantity) <= 0
      ) {
        toast.error("Invalid quantity", {
          description: "Please enter a valid quantity",
        });
        return;
      }

      // Check balance
      if (!hasEnoughBalance) {
        toast.error("Insufficient balance", {
          description: `You need ${formatCurrency(
            orderCost
          )} to place this order`,
        });
        return;
      }

      setIsSubmitting(true);

      // Convert values to numbers first
      const priceValue = parseFloat(price);
      const quantityValue = parseFloat(quantity);

      // Process stop loss and take profit
      // These variables are used for validation only
      let tempStopLossValue: number | undefined = undefined;
      let tempTakeProfitValue: number | undefined = undefined;

      if (stopLoss && !isNaN(Number(stopLoss)) && Number(stopLoss) > 0) {
        tempStopLossValue = Number(stopLoss);
      }

      if (takeProfit && !isNaN(Number(takeProfit)) && Number(takeProfit) > 0) {
        tempTakeProfitValue = Number(takeProfit);
      }

      // Validate stop loss and take profit
      if (tempStopLossValue !== undefined) {
        if (orderSide === "BUY" && tempStopLossValue >= priceValue) {
          toast.error("Invalid stop loss", {
            description:
              "Stop loss must be below the entry price for buy orders",
          });
          return;
        }
        if (orderSide === "SELL" && tempStopLossValue <= priceValue) {
          toast.error("Invalid stop loss", {
            description:
              "Stop loss must be above the entry price for sell orders",
          });
          return;
        }
      }

      if (tempTakeProfitValue !== undefined) {
        if (orderSide === "BUY" && tempTakeProfitValue <= priceValue) {
          toast.error("Invalid take profit", {
            description:
              "Take profit must be above the entry price for buy orders",
          });
          return;
        }
        if (orderSide === "SELL" && tempTakeProfitValue >= priceValue) {
          toast.error("Invalid take profit", {
            description:
              "Take profit must be below the entry price for sell orders",
          });
          return;
        }
      }

      // Use the already converted values
      const stopLossValue = tempStopLossValue;
      const takeProfitValue = tempTakeProfitValue;

      console.log("Order submission values:", {
        symbolId: symbolId,
        price: priceValue, // Full BTC price (e.g., 85919.00)
        quantity: quantityValue,
        type: orderSide,
        isShort: orderSide === "SELL",
        stopLoss: stopLossValue, // Full BTC stop loss price
        takeProfit: takeProfitValue, // Full BTC take profit price
      });

      const response = await createOrder({
        symbolId: symbolId,
        type: orderSide,
        price: priceValue,
        quantity: quantityValue,
        isShort: orderSide === "SELL",
        stopLoss: stopLossValue,
        takeProfit: takeProfitValue,
      });

      if (response) {
        console.log("Order created successfully:", response);
        toast.success("Order placed successfully", {
          description: `${orderSide} ${quantity} ${symbol
            .slice(0, -4)
            .toUpperCase()} at ${formatCurrency(priceValue)}`,
        });

        // Reset form for stop loss and take profit
        setStopLoss("");
        setTakeProfit("");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error(
        `Error placing order: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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

          {/* Order Preview Section */}
          <div className="mt-4 p-3 bg-muted/40 rounded-md">
            <div className="text-sm font-medium mb-2">Order Preview</div>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Value:</span>
                <span className="font-medium">{formatCurrency(orderCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Available Balance:
                </span>
                <span className="font-medium">{formatCurrency(available)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price:</span>
                <span className="font-medium">
                  {currentPrice.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Spread Fee ({spreadFeePercent}%):
                </span>
                <span className="font-medium">{spreadFeeAmount} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final Price:</span>
                <span className="font-medium">{formattedPrice} USD</span>
              </div>

              {!hasEnoughBalance && (
                <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Insufficient balance for this order</span>
                </div>
              )}

              {stopLoss && takeProfit && (
                <div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
                  <Info className="h-4 w-4" />
                  <span>Stop Loss and Take Profit will be set</span>
                </div>
              )}

              {orderSide === "BUY" ? (
                <Badge className="mt-2 bg-green-600">
                  BUY {quantity} {symbol.toUpperCase()}
                </Badge>
              ) : (
                <Badge variant="destructive" className="mt-2">
                  SELL {quantity} {symbol.toUpperCase()}
                </Badge>
              )}
            </div>
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
