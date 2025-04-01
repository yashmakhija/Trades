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
  CandlestickData,
} from "lightweight-charts";
import { useWebSocket, CandleData } from "@/services/websocket";
import {
  fetchHistoricalData,
  generateMockHistoricalData,
  Timeframe,
  getCandleCount,
} from "@/services/marketData";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

  // State for historical data loading
  const [dataPageCount, setDataPageCount] = useState<number>(0);
  const [totalCandleCount, setTotalCandleCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

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

  // Add this helper function at the top level of the component
  const deduplicateCandles = (candles: CandleData[]): CandleData[] => {
    // Create a map to store aggregated candles for each timestamp
    const candleMap = new Map<number, CandleData>();

    candles.forEach((candle) => {
      const timestamp =
        typeof candle.time === "string"
          ? Math.floor(new Date(candle.time).getTime() / 1000)
          : candle.time;

      const existingCandle = candleMap.get(timestamp);

      if (existingCandle) {
        // Aggregate candles with the same timestamp
        existingCandle.high = Math.max(existingCandle.high, candle.high);
        existingCandle.low = Math.min(existingCandle.low, candle.low);
        existingCandle.close = candle.close; // Use the latest close price
        existingCandle.volume += candle.volume; // Sum the volumes
      } else {
        // Create a new candle entry
        candleMap.set(timestamp, {
          ...candle,
          time: timestamp,
        });
      }
    });

    // Convert map values back to array and sort by timestamp
    return Array.from(candleMap.values()).sort((a, b) => {
      const timeA =
        typeof a.time === "string"
          ? Math.floor(new Date(a.time).getTime() / 1000)
          : a.time;
      const timeB =
        typeof b.time === "string"
          ? Math.floor(new Date(b.time).getTime() / 1000)
          : b.time;
      return timeA - timeB;
    });
  };

  // Update the loadData function
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDataPageCount(0);

    try {
      console.log(
        `PriceChart: Fetching historical candles for ${normalizedSymbol}:${timeframe}`
      );

      let data: CandleData[];
      if (useMockData) {
        console.log("PriceChart: Using mock data...");
        data = generateMockHistoricalData(
          normalizedSymbol.includes("btc") ? 45000 : 2000,
          100
        );
      } else {
        // Get count first to know how much data is available
        const count = await getCandleCount(normalizedSymbol, timeframe);
        setTotalCandleCount(count);
        console.log(`PriceChart: Total available candles: ${count}`);

        // Load initial data with a reasonable limit
        const initialLimit = Math.min(1000, count);
        data = await fetchHistoricalData(
          normalizedSymbol,
          timeframe,
          initialLimit,
          undefined,
          undefined,
          0,
          false
        );

        setDataPageCount(1);
      }

      if (data && data.length > 0) {
        console.log(
          `PriceChart: Loaded ${data.length} historical candles for ${normalizedSymbol}:${timeframe}`
        );

        // Deduplicate candles with the same timestamp
        const uniqueData = deduplicateCandles(data);
        console.log(
          `PriceChart: Deduplicated to ${uniqueData.length} unique candles`
        );

        // Convert to the correct type for the chart library
        const chartData = uniqueData.map((candle) => ({
          time: (typeof candle.time === "string"
            ? Math.floor(new Date(candle.time).getTime() / 1000)
            : candle.time) as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }));

        // Sort data by timestamp to ensure correct order
        chartData.sort((a, b) => (a.time as number) - (b.time as number));

        if (candleSeries.current) {
          candleSeries.current.setData(chartData);
        }

        // Update volume series
        if (volumeSeries.current) {
          const volumeData = chartData.map((item) => ({
            time: item.time,
            value: item.volume,
            color:
              item.close >= item.open
                ? chartColors.volumeUp
                : chartColors.volumeDown,
          }));
          volumeSeries.current.setData(volumeData);
        }

        // Set the last candle reference
        lastCandleRef.current = {
          time: chartData[chartData.length - 1].time,
          data: {
            open: chartData[chartData.length - 1].open,
            high: chartData[chartData.length - 1].high,
            low: chartData[chartData.length - 1].low,
            close: chartData[chartData.length - 1].close,
          },
        };

        // Update current price and price change
        setCurrentPrice(uniqueData[uniqueData.length - 1].close);
        if (uniqueData.length > 1) {
          const first = uniqueData[0].open;
          const last = uniqueData[uniqueData.length - 1].close;
          const change = ((last - first) / first) * 100;
          setPriceChange(change);
        }

        setHistoricalDataLoaded(true);

        // Fit content to view after data is loaded
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } else {
        console.warn(
          `PriceChart: No historical candles received for ${normalizedSymbol}:${timeframe}`
        );
        setError("No historical data available");
      }
    } catch (err) {
      console.error(
        `PriceChart: Error loading historical data for ${normalizedSymbol}:${timeframe}:`,
        err
      );
      setError("Failed to load historical data");
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial historical data
  useEffect(() => {
    if (!chartRef.current || !candleSeries.current || !normalizedSymbol) {
      return;
    }

    loadData();
  }, [normalizedSymbol, timeframe, chartColors, useMockData]);

  /**
   * Load more historical data when requested
   */
  const loadMoreHistoricalData = async () => {
    if (!chartRef.current || !candleSeries.current || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      console.log(
        `PriceChart: Loading more historical data (page ${dataPageCount})`
      );

      const currentData =
        candleSeries.current.data() as CandlestickData<UTCTimestamp>[];

      if (!currentData || currentData.length === 0) {
        toast.error("No current data available to extend");
        return;
      }

      // Find the earliest timestamp
      const earliestTime = Math.min(
        ...currentData.map((candle) =>
          typeof candle.time === "number"
            ? candle.time
            : (candle.time as UTCTimestamp).valueOf()
        )
      );
      const endTime = new Date(earliestTime * 1000);

      // Load the next page of data
      const moreData = await fetchHistoricalData(
        normalizedSymbol,
        timeframe,
        1000,
        undefined,
        endTime,
        dataPageCount
      );

      if (moreData.length > 0) {
        // Deduplicate new data
        const uniqueMoreData = deduplicateCandles(moreData);
        console.log(
          `PriceChart: Deduplicated to ${uniqueMoreData.length} unique candles`
        );

        // Convert to chart data format
        const chartData = uniqueMoreData.map((candle) => ({
          time: (typeof candle.time === "string"
            ? Math.floor(new Date(candle.time).getTime() / 1000)
            : candle.time) as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }));

        // Sort data by timestamp
        chartData.sort((a, b) => (a.time as number) - (b.time as number));

        // Get existing timestamps for duplicate detection
        const existingTimestamps = new Set(
          currentData.map((candle) =>
            typeof candle.time === "number"
              ? candle.time
              : (candle.time as UTCTimestamp).valueOf()
          )
        );

        // Filter out duplicates
        const newCandles = chartData.filter(
          (candle) =>
            !existingTimestamps.has(
              typeof candle.time === "number"
                ? candle.time
                : (candle.time as UTCTimestamp).valueOf()
            )
        );

        if (newCandles.length > 0) {
          // Combine and sort all data
          const combinedData = [...currentData, ...newCandles].sort((a, b) => {
            const timeA =
              typeof a.time === "number"
                ? a.time
                : (a.time as UTCTimestamp).valueOf();
            const timeB =
              typeof b.time === "number"
                ? b.time
                : (b.time as UTCTimestamp).valueOf();
            return timeA - timeB;
          });

          // Update chart data
          if (candleSeries.current) {
            candleSeries.current.setData(combinedData);
          }

          // Update volume data
          if (volumeSeries.current) {
            const volumeData = combinedData.map((item) => ({
              time: item.time,
              value: (item as unknown as { volume: number }).volume,
              color:
                item.close >= item.open
                  ? chartColors.volumeUp
                  : chartColors.volumeDown,
            }));
            volumeSeries.current.setData(volumeData);
          }

          setDataPageCount((prev) => prev + 1);
          toast.success(`Loaded ${newCandles.length} more historical candles`);
        } else {
          toast.info("No more historical data available");
        }
      } else {
        toast.info("No more historical data available");
      }
    } catch (error) {
      console.error("Error loading more historical data:", error);
      toast.error("Failed to load more historical data");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Update chart with real-time data from WebSocket
  useEffect(() => {
    if (
      !candleSeries.current ||
      !volumeSeries.current ||
      !historicalDataLoaded
    ) {
      return;
    }

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

      // Convert time to UTC timestamp
      const candleTime = (
        typeof latestCandle.time === "string"
          ? Math.floor(new Date(latestCandle.time).getTime() / 1000)
          : latestCandle.time
      ) as UTCTimestamp;

      if (typeof candleTime !== "number" || isNaN(candleTime)) {
        console.warn(
          `PriceChart: Invalid candle time: ${candleTime}, skipping update`
        );
        return;
      }

      // Check if this is a new candle or an update to the current one
      const isNewCandle =
        !lastCandleRef.current || lastCandleRef.current.time !== candleTime;

      // Update the candle data
      if (candleSeries.current) {
        candleSeries.current.update({
          time: candleTime,
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
        });
      }

      // Update the volume data
      if (volumeSeries.current) {
        volumeSeries.current.update({
          time: candleTime,
          value: latestCandle.volume,
          color:
            latestCandle.close >= latestCandle.open
              ? chartColors.volumeUp
              : chartColors.volumeDown,
        });
      }

      // Store the last candle reference
      lastCandleRef.current = {
        time: candleTime,
        data: {
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
        },
      };

      // Update current price and price change
      setCurrentPrice(latestCandle.close);
      if (timeframeData.length > 1) {
        const firstCandle = timeframeData[0];
        const priceChange =
          ((latestCandle.close - firstCandle.open) / firstCandle.open) * 100;
        setPriceChange(priceChange);
      }

      // If it's a new candle, scroll to real-time
      if (isNewCandle && chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
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
    isSubscribedToTimeframe,
    subscribeToCandles,
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
      <CardHeader className="p-0">
        <div className="flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center px-4 py-2 gap-2 border-b">
            <div className="flex gap-2 items-center">
              <h2 className="text-lg font-semibold whitespace-nowrap truncate">
                {normalizedSymbol.toUpperCase()} Chart
              </h2>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <Tabs
              value={timeframe}
              defaultValue={timeframe}
              className="w-full sm:w-auto justify-self-start sm:justify-self-center"
              onValueChange={handleTimeframeChange}
            >
              <TabsList className="grid grid-cols-7 max-w-xs h-8">
                <TabsTrigger value="1m" className="text-xs h-6">
                  1m
                </TabsTrigger>
                <TabsTrigger value="5m" className="text-xs h-6">
                  5m
                </TabsTrigger>
                <TabsTrigger value="15m" className="text-xs h-6">
                  15m
                </TabsTrigger>
                <TabsTrigger value="30m" className="text-xs h-6">
                  30m
                </TabsTrigger>
                <TabsTrigger value="1h" className="text-xs h-6">
                  1h
                </TabsTrigger>
                <TabsTrigger value="4h" className="text-xs h-6">
                  4h
                </TabsTrigger>
                <TabsTrigger value="1d" className="text-xs h-6">
                  1d
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-row-reverse justify-between sm:justify-end gap-4 text-xs text-muted-foreground items-center">
              <div className="flex items-center gap-1">
                <span>{currentPrice ? formatPrice(currentPrice) : "-"}</span>
                <span
                  className={`flex items-center ${
                    priceChange >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </span>
              </div>

              {/* Add historical data stats and load more button */}
              <div className="flex items-center gap-2">
                {totalCandleCount > 0 && candleSeries.current && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {(
                      candleSeries.current.data() as CandlestickData<UTCTimestamp>[]
                    )?.length || 0}
                    /{totalCandleCount} candles
                  </span>
                )}
                {!isLoading && dataPageCount > 0 && !useMockData && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={loadMoreHistoricalData}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Load More
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
                onClick={() => loadMoreHistoricalData()}
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
