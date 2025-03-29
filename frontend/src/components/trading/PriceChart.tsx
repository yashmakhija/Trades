"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  ColorType,
  ChartOptions,
  DeepPartial,
  UTCTimestamp,
  ISeriesApi,
  IChartApi,
  CandlestickSeries,
  HistogramSeries,
  Time,
  LineStyle,
  PriceScaleMode,
  HistogramSeriesOptions,
} from "lightweight-charts";
import { useWebSocket, CandleData } from "@/services/websocket";
import {
  fetchHistoricalData,
  generateMockHistoricalData,
  Timeframe,
} from "@/services/marketData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createOrder } from "@/services/orders";
import { useAuthStore } from "@/store/use-auth-store";
import { DEFAULT_ORDER_QUANTITY, SPREAD_FEE_PERCENTAGE } from "@/config";
import { useSymbolStore } from "@/store/use-symbol-store";
import { Loader2 } from "lucide-react";

// Define a type for the watermark options
interface WatermarkOptions {
  color: string;
  visible: boolean;
  text: string;
  fontSize: number;
  horzAlign: "center" | "left" | "right";
  vertAlign: "center" | "top" | "bottom";
}

// Define a type for the last candle reference
interface LastCandle {
  time: Time;
  data: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

interface PriceChartProps {
  symbol: string;
  initialTimeframe?: Timeframe;
  height?: number;
  useMockData?: boolean;
  className?: string;
}

export function PriceChart({
  symbol,
  initialTimeframe = "1m",
  height = 400,
  useMockData = false,
  className = "",
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const lastCandleRef = useRef<LastCandle | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingTimeframe, setIsChangingTimeframe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const { isAuthenticated } = useAuthStore();
  const [quantity, setQuantity] = useState<string>(
    DEFAULT_ORDER_QUANTITY.toString()
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastTimeframeChange, setLastTimeframeChange] = useState<number>(
    Date.now()
  );

  // Don't destructure symbols from the store as we'll access it directly when needed
  // to ensure we always have the latest data
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";

  const {
    candleData,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
    unsubscribeFromCandles,
    isSubscribedToTimeframe,
  } = useWebSocket();

  // Normalize symbol to lowercase for consistency
  const normalizedSymbol = useMemo(() => symbol.toLowerCase(), [symbol]);

  // Chart colors based on theme
  const chartColors = useMemo(
    () => ({
      background: "transparent",
      text: isDarkTheme ? "rgba(255, 255, 255, 0.9)" : "rgba(60, 60, 60, 0.9)",
      grid: isDarkTheme ? "rgba(42, 46, 57, 0.6)" : "rgba(197, 203, 206, 0.4)",
      border: isDarkTheme
        ? "rgba(56, 62, 75, 0.8)"
        : "rgba(197, 203, 206, 0.8)",
      upColor: "rgba(38, 166, 154, 1)",
      downColor: "rgba(239, 83, 80, 1)",
      volumeUp: "rgba(38, 166, 154, 0.5)",
      volumeDown: "rgba(239, 83, 80, 0.5)",
      crosshair: isDarkTheme
        ? "rgba(197, 203, 206, 0.5)"
        : "rgba(117, 123, 126, 0.5)",
      watermark: isDarkTheme
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0, 0, 0, 0.03)",
    }),
    [isDarkTheme]
  );

  // Subscribe to symbol and candles
  useEffect(() => {
    console.log(`PriceChart: Setting up for symbol ${normalizedSymbol}`);

    const initSymbols = async () => {
      const currentSymbols = useSymbolStore.getState().symbols;
      if (currentSymbols.length === 0) {
        console.log("Symbol store empty, performing initial fetch");
        try {
          await useSymbolStore.getState().fetchSymbols();
        } catch (error) {
          console.error("Failed to fetch initial symbols:", error);
        }
      } else {
        console.log(
          "Using existing symbols from store:",
          currentSymbols.map((s) => `${s.name} (${s.id})`).join(", ")
        );
      }
    };

    initSymbols();

    // Set the active symbol and timeframe first
    setActiveSymbol(normalizedSymbol);
    setActiveTimeframe(timeframe);

    // Then subscribe to both the symbol and the candles
    subscribeToSymbol(normalizedSymbol);
    subscribeToCandles(normalizedSymbol, timeframe);

    // Clean up subscriptions when component unmounts
    return () => {
      console.log(
        `PriceChart: Component unmounting, unsubscribing from ${normalizedSymbol}:${timeframe}`
      );
      // We don't unsubscribe from the symbol as other components might still need it
      unsubscribeFromCandles(normalizedSymbol, timeframe);
    };
  }, [
    normalizedSymbol,
    timeframe,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
    unsubscribeFromCandles,
  ]);

  // Format price for display
  const formatPrice = useCallback((price: number): string => {
    // For crypto, use appropriate decimal places based on price magnitude
    if (price >= 10000) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (price >= 1000) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (price >= 1) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    } else {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 8,
      });
    }
  }, []);

  // Update the normalizePrice function to properly handle different cryptocurrency price scales
  const normalizePrice = useCallback((price: number): number => {
    // Just return the original price without any conversion
    return price;
  }, []);

  // Initialize chart
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      try {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeries.current = null;
        volumeSeries.current = null;
      } catch (error) {
        console.log(
          "Chart was already disposed or invalid, creating new instance"
        );
      }
    }

    const options: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: chartColors.background },
        textColor: chartColors.text,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: {
          color: chartColors.grid,
          style: LineStyle.Dotted,
        },
        horzLines: {
          color: chartColors.grid,
          style: LineStyle.Dotted,
        },
      },
      timeScale: {
        borderColor: chartColors.border,
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const hours = date.getHours().toString().padStart(2, "0");
          const minutes = date.getMinutes().toString().padStart(2, "0");
          return `${hours}:${minutes}`;
        },
      },
      crosshair: {
        vertLine: {
          color: chartColors.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          visible: true,
          labelVisible: true,
        },
        horzLine: {
          color: chartColors.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          visible: true,
          labelVisible: true,
        },
        mode: 1,
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
    };

    // Add watermark options separately since it's not in the TypeScript definitions
    const fullOptions = {
      ...options,
      watermark: {
        color: chartColors.watermark,
        visible: true,
        text: normalizedSymbol.toUpperCase(),
        fontSize: 56,
        horzAlign: "center",
        vertAlign: "center",
      } as WatermarkOptions,
    };

    try {
      chartRef.current = createChart(chartContainerRef.current, {
        ...fullOptions,
        width: chartContainerRef.current.clientWidth,
        height: height,
      } as DeepPartial<ChartOptions>);

      // Determine price format based on symbol
      const isPriceLarge = normalizedSymbol.includes("btc");

      candleSeries.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: chartColors.upColor,
        downColor: chartColors.downColor,
        borderVisible: false,
        wickUpColor: chartColors.upColor,
        wickDownColor: chartColors.downColor,
        priceFormat: {
          type: "price",
          precision: isPriceLarge ? 2 : 4,
          minMove: isPriceLarge ? 0.01 : 0.0001,
        },
        priceScaleId: "right",
      });

      // Configure the price scale
      chartRef.current.priceScale("right").applyOptions({
        borderVisible: true,
        borderColor: chartColors.border,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        mode: PriceScaleMode.Normal,
        autoScale: true,
        entireTextOnly: false,
      });

      // The lightweight-charts library has incomplete TypeScript definitions for histogram series options
      volumeSeries.current = chartRef.current.addSeries(HistogramSeries, {
        color: "rgba(56, 33, 110, 0.3)",
        priceFormat: {
          type: "volume",
          precision: 0,
        },
        priceScaleId: "",
        // The scaleMargins property is supported but TypeScript definitions might be incomplete
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      } as DeepPartial<HistogramSeriesOptions>);

      // Set up resize observer for responsive chart
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }

      resizeObserver.current = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        if (chartRef.current && width > 0) {
          chartRef.current.applyOptions({ width });
          chartRef.current.timeScale().fitContent();
        }
      });

      resizeObserver.current.observe(chartContainerRef.current);

      console.log("PriceChart: Chart initialized successfully");
    } catch (err) {
      console.error("PriceChart: Error initializing chart:", err);
      setError("Failed to initialize chart. Please try refreshing the page.");
    }
  }, [height, chartColors, normalizedSymbol]);

  // Initialize chart on mount and when theme changes
  useEffect(() => {
    initializeChart();

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [initializeChart]);

  // Load historical data
  const loadHistoricalData = useCallback(async () => {
    if (!candleSeries.current || !volumeSeries.current) return;

    setIsLoading(true);
    setIsChangingTimeframe(true);
    setError(null);

    try {
      console.log(
        `PriceChart: Loading historical data for ${normalizedSymbol} with timeframe ${timeframe}`
      );

      let historicalData: CandleData[];

      if (useMockData) {
        historicalData = generateMockHistoricalData(
          normalizedSymbol.includes("btc") ? 83000 : 2000,
          100
        );
        console.log(
          `PriceChart: Generated mock data for ${normalizedSymbol}:`,
          historicalData.length,
          "candles"
        );
      } else {
        historicalData = await fetchHistoricalData(
          normalizedSymbol,
          timeframe,
          100
        );
        console.log(
          `PriceChart: Fetched historical data for ${normalizedSymbol}:`,
          historicalData.length,
          "candles"
        );
      }

      if (historicalData.length === 0) {
        console.warn(
          `PriceChart: No historical data available for ${normalizedSymbol}`
        );
        setError(
          `No historical data available for ${normalizedSymbol.toUpperCase()}`
        );
        return;
      }

      // Process data for display
      const candleStickData = historicalData.map((candle) => {
        // Normalize price values if needed
        const open = normalizePrice(candle.open);
        const high = normalizePrice(candle.high);
        const low = normalizePrice(candle.low);
        const close = normalizePrice(candle.close);

        return {
          time: candle.time as UTCTimestamp,
          open,
          high,
          low,
          close,
        };
      });

      const volumeData = historicalData.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color:
          normalizePrice(candle.close) >= normalizePrice(candle.open)
            ? chartColors.volumeUp
            : chartColors.volumeDown,
      }));

      // Reset data before setting new data to avoid visual glitches
      candleSeries.current.setData([]);
      volumeSeries.current.setData([]);

      // Set new data
      candleSeries.current.setData(candleStickData);
      volumeSeries.current.setData(volumeData);

      // Store the last candle for reference
      if (candleStickData.length > 0) {
        const lastCandle = candleStickData[candleStickData.length - 1];
        lastCandleRef.current = {
          time: lastCandle.time,
          data: {
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          },
        };
      }

      // Update current price and price change
      if (historicalData.length > 0) {
        const lastCandle = historicalData[historicalData.length - 1];
        const firstCandle = historicalData[0];
        const normalizedLastClose = normalizePrice(lastCandle.close);
        setCurrentPrice(normalizedLastClose);

        // Calculate price change percentage
        const normalizedFirstOpen = normalizePrice(firstCandle.open);
        const priceChange =
          ((normalizedLastClose - normalizedFirstOpen) / normalizedFirstOpen) *
          100;
        setPriceChange(priceChange);
      }

      // Fit content to view
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      setHistoricalDataLoaded(true);
      console.log(
        `PriceChart: Chart updated with historical data for ${normalizedSymbol}`
      );
    } catch (err) {
      console.error(
        `PriceChart: Error loading historical data for ${normalizedSymbol}:`,
        err
      );
      setError(`Failed to load data for ${normalizedSymbol.toUpperCase()}`);
    } finally {
      setIsLoading(false);
      // Short delay before removing the timeframe change overlay
      setTimeout(() => {
        setIsChangingTimeframe(false);
      }, 300);
    }
  }, [normalizedSymbol, timeframe, useMockData, chartColors, normalizePrice]);

  // Load historical data when symbol or timeframe changes
  useEffect(() => {
    setHistoricalDataLoaded(false);
    loadHistoricalData();

    // Mark the time of the timeframe change to debounce updates
    setLastTimeframeChange(Date.now());
  }, [normalizedSymbol, timeframe, loadHistoricalData]);

  // Update chart with real-time data from WebSocket
  useEffect(() => {
    if (
      !candleSeries.current ||
      !volumeSeries.current ||
      !historicalDataLoaded
    ) {
      return;
    }

    // Check if we're subscribed to the current timeframe
    if (!isSubscribedToTimeframe(normalizedSymbol, timeframe)) {
      console.log(
        `PriceChart: Not subscribed to ${normalizedSymbol}:${timeframe}, subscribing now`
      );
      subscribeToCandles(normalizedSymbol, timeframe);
      return;
    }

    const symbolData = candleData[normalizedSymbol];
    if (
      !symbolData ||
      !symbolData[timeframe] ||
      symbolData[timeframe].length === 0
    ) {
      return;
    }

    try {
      const timeframeData = symbolData[timeframe];
      const latestCandle = timeframeData[timeframeData.length - 1];

      if (!latestCandle) {
        console.warn(
          `PriceChart: No candle data available for ${normalizedSymbol}:${timeframe}`
        );
        return;
      }

      // Ensure time is in the correct format (seconds since epoch)
      let candleTime: UTCTimestamp;

      // Convert time to a proper timestamp number
      if (typeof latestCandle.time === "string") {
        candleTime = Math.floor(
          new Date(latestCandle.time).getTime() / 1000
        ) as UTCTimestamp;
      } else if (
        typeof latestCandle.time === "number" &&
        latestCandle.time > 10000000000
      ) {
        // If timestamp is in milliseconds, convert to seconds
        candleTime = Math.floor(latestCandle.time / 1000) as UTCTimestamp;
      } else if (typeof latestCandle.time === "number") {
        candleTime = latestCandle.time as UTCTimestamp;
      } else {
        console.warn("Invalid time format:", latestCandle.time);
        return;
      }

      // Make sure we have valid data before updating
      if (typeof candleTime !== "number" || isNaN(candleTime)) {
        console.warn(
          `PriceChart: Invalid candle time: ${candleTime}, skipping update`
        );
        return;
      }

      // Check if this is a new candle or an update to the current one
      const isNewCandle =
        !lastCandleRef.current || lastCandleRef.current.time !== candleTime;

      // If we recently changed timeframes, make sure this update isn't stale
      const timeSinceLastChange = Date.now() - lastTimeframeChange;
      if (timeSinceLastChange < 1000 && !isNewCandle) {
        // Skip updates right after timeframe change to avoid flicker
        return;
      }

      // Normalize price values
      const normalizedOpen = normalizePrice(latestCandle.open);
      const normalizedHigh = normalizePrice(latestCandle.high);
      const normalizedLow = normalizePrice(latestCandle.low);
      const normalizedClose = normalizePrice(latestCandle.close);

      // Log the update for debugging
      if (isNewCandle) {
        console.log(
          `PriceChart: New candle for ${normalizedSymbol}:${timeframe}`,
          {
            time: candleTime,
            open: normalizedOpen,
            high: normalizedHigh,
            low: normalizedLow,
            close: normalizedClose,
          }
        );
      }

      try {
        // Update the candle data
        candleSeries.current.update({
          time: candleTime,
          open: normalizedOpen,
          high: normalizedHigh,
          low: normalizedLow,
          close: normalizedClose,
        });

        // Update the volume data
        volumeSeries.current.update({
          time: candleTime,
          value: latestCandle.volume,
          color:
            normalizedClose >= normalizedOpen
              ? chartColors.volumeUp
              : chartColors.volumeDown,
        });

        // Store the last candle for reference
        lastCandleRef.current = {
          time: candleTime,
          data: {
            open: normalizedOpen,
            high: normalizedHigh,
            low: normalizedLow,
            close: normalizedClose,
          },
        };

        // Update current price
        setCurrentPrice(normalizedClose);

        // Update price change if we have historical data
        if (timeframeData.length > 1) {
          const firstCandle = timeframeData[0];
          const normalizedFirstOpen = normalizePrice(firstCandle.open);
          const priceChange =
            ((normalizedClose - normalizedFirstOpen) / normalizedFirstOpen) *
            100;
          setPriceChange(priceChange);
        }

        // If it's a new candle, fit content to view
        if (isNewCandle && chartRef.current) {
          chartRef.current.timeScale().scrollToRealTime();
        }
      } catch (error) {
        console.error(
          `PriceChart: Error updating chart with real-time data:`,
          error
        );
      }
    } catch (error) {
      console.error(
        `PriceChart: Error updating chart with real-time data:`,
        error
      );
    }
  }, [
    candleData,
    normalizedSymbol,
    timeframe,
    historicalDataLoaded,
    chartColors,
    normalizePrice,
    isSubscribedToTimeframe,
    subscribeToCandles,
    lastTimeframeChange,
  ]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback(
    (value: string) => {
      const newTimeframe = value as Timeframe;
      if (newTimeframe === timeframe) return; // Skip if same timeframe

      console.log(`PriceChart: Changing timeframe to ${newTimeframe}`);

      // Set loading state
      setIsChangingTimeframe(true);

      // First make sure we're subscribed to the new timeframe
      if (!isSubscribedToTimeframe(normalizedSymbol, newTimeframe)) {
        subscribeToCandles(normalizedSymbol, newTimeframe);
      }

      // Then update UI state
      setTimeframe(newTimeframe);
      setActiveTimeframe(newTimeframe);
    },
    [
      normalizedSymbol,
      timeframe,
      setActiveTimeframe,
      subscribeToCandles,
      isSubscribedToTimeframe,
    ]
  );

  // Handle quick order submission
  const handleQuickOrder = async (side: "BUY" | "SELL") => {
    if (!isAuthenticated) {
      toast.error("Authentication required", {
        description: "Please log in to place orders",
      });
      return;
    }

    if (!currentPrice) {
      toast.error("Price not available", {
        description: "Current price is not available. Please try again.",
      });
      return;
    }

    // Get current symbols from store
    const currentSymbols = useSymbolStore.getState().symbols;

    // Only force refresh if necessary (no symbols or outdated cache)
    let symbolsToUse = currentSymbols;
    if (currentSymbols.length === 0) {
      console.log("No symbols in store, fetching before order");
      symbolsToUse = await useSymbolStore.getState().fetchSymbolsForce();
    } else {
      // Check if cache is stale (more than 5 minutes old)
      const lastFetched = useSymbolStore.getState().lastFetched || 0;
      const cacheAge = Date.now() - lastFetched;
      const FIVE_MINUTES = 5 * 60 * 1000;

      if (cacheAge > FIVE_MINUTES) {
        console.log(
          `Symbol cache is ${Math.round(
            cacheAge / 1000 / 60
          )} minutes old, refreshing before order`
        );
        symbolsToUse = await useSymbolStore.getState().fetchSymbolsForce();
      } else {
        console.log(
          `Using symbol cache (${Math.round(cacheAge / 1000)} seconds old)`
        );
      }
    }

    // Find the exact symbol match by standardizing both strings for comparison
    const symbolKey = normalizedSymbol.toLowerCase().trim();

    // Find with exact matching using symbols
    const symbolData = symbolsToUse.find(
      (s) => s.name.toLowerCase().trim() === symbolKey
    );

    if (!symbolData) {
      console.error("Symbol lookup error:", {
        lookingFor: symbolKey,
        availableSymbols: symbolsToUse.map(
          (s) => `${s.name.toLowerCase().trim()} (${s.id})`
        ),
      });

      toast.error("Symbol not found", {
        description: `Unable to find symbol '${symbolKey}' in available symbols. Please refresh the page.`,
      });
      return;
    }

    console.log("Symbol found for order:", {
      name: symbolData.name,
      id: symbolData.id,
      symbolKey,
    });

    try {
      setIsSubmitting(true);
      const quantityValue = parseFloat(quantity);

      // Apply spread fee to price based on order side
      const spreadAmount = currentPrice * SPREAD_FEE_PERCENTAGE;
      const priceWithSpread =
        side === "BUY"
          ? currentPrice + spreadAmount // Higher price for buyers
          : currentPrice - spreadAmount; // Lower price for sellers

      // Ensure the request data format matches exactly what the API expects
      const orderData = {
        symbolId: symbolData.id,
        type: side,
        price: priceWithSpread,
        quantity: quantityValue,
        isShort: side === "SELL",
      };

      console.log("Submitting order:", orderData);

      const response = await createOrder(orderData);

      if (response) {
        toast.success(`${side} order placed successfully`, {
          description: `${side} ${quantity} ${normalizedSymbol.toUpperCase()} at ${formatPrice(
            priceWithSpread
          )}`,
        });
      }
    } catch (error) {
      console.error("Error placing quick order:", error);
      toast.error(
        `Error placing order: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-0">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <CardTitle className="text-lg font-semibold">
                {normalizedSymbol.toUpperCase()} Chart
              </CardTitle>
              {currentPrice !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold">
                    {formatPrice(currentPrice)}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      priceChange >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <Tabs
              defaultValue={timeframe}
              value={timeframe}
              onValueChange={handleTimeframeChange}
              className="h-8"
            >
              <TabsList className="h-8 bg-background/50">
                <TabsTrigger
                  value="1m"
                  className="h-7 px-2 text-xs"
                  disabled={isChangingTimeframe}
                >
                  1m
                </TabsTrigger>
                <TabsTrigger
                  value="5m"
                  className="h-7 px-2 text-xs"
                  disabled={isChangingTimeframe}
                >
                  5m
                </TabsTrigger>
                <TabsTrigger
                  value="15m"
                  className="h-7 px-2 text-xs"
                  disabled={isChangingTimeframe}
                >
                  15m
                </TabsTrigger>
                <TabsTrigger
                  value="1h"
                  className="h-7 px-2 text-xs"
                  disabled={isChangingTimeframe}
                >
                  1h
                </TabsTrigger>
                <TabsTrigger
                  value="1d"
                  className="h-7 px-2 text-xs"
                  disabled={isChangingTimeframe}
                >
                  1d
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-0 relative">
        {/* Floating Buy/Sell bar */}
        <div className="absolute top-4 left-4 z-10 flex rounded-md overflow-hidden border border-border shadow-md">
          <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-8 text-sm font-bold rounded-none border-0"
            disabled={isSubmitting || !isAuthenticated}
            onClick={() => handleQuickOrder("BUY")}
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            BUY
          </Button>

          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-16 text-center font-mono text-sm border-0 h-8 rounded-none bg-card"
            min="0.001"
            step="0.001"
            disabled={isSubmitting}
          />

          <Button
            variant="destructive"
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white px-5 h-8 text-sm font-bold rounded-none border-0"
            disabled={isSubmitting || !isAuthenticated}
            onClick={() => handleQuickOrder("SELL")}
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            SELL
          </Button>
        </div>

        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">
                Loading chart data...
              </p>
            </div>
          </div>
        )}

        {isChangingTimeframe && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[1px] transition-opacity duration-300">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p className="text-xs text-muted-foreground">
                Changing timeframe...
              </p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 max-w-xs text-center p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => loadHistoricalData()}
                className="text-xs text-primary hover:underline mt-2"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
