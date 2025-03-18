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
  const [error, setError] = useState<string | null>(null);
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";

  const {
    candleData,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
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

    // Subscribe to symbol and candles
    subscribeToSymbol(normalizedSymbol);
    setActiveSymbol(normalizedSymbol);
    setActiveTimeframe(timeframe);
    subscribeToCandles(normalizedSymbol, timeframe);

    return () => {
      // No need to unsubscribe on unmount as other components might need the data
      console.log(`PriceChart: Component unmounting`);
    };
  }, [
    normalizedSymbol,
    timeframe,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
  ]);

  // Format price for display
  const formatPrice = useCallback((price: number): string => {
    // For crypto, use appropriate decimal places based on price magnitude
    if (price >= 1000) {
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
  const normalizePrice = useCallback(
    (price: number): number => {
      // If price is already in proper format (floating point), return it
      if (price < 1_000_000) {
        return price;
      }

      // Handle different cryptocurrencies with different price scales
      const symbolLower = normalizedSymbol.toLowerCase();

      // For debugging
      console.log(`PriceChart: Normalizing price ${price} for ${symbolLower}`);

      // High value coins use 2 decimal places (price in cents)
      if (symbolLower.includes("btc") || symbolLower.includes("eth")) {
        return price / 100;
      }

      // Mid value coins
      if (symbolLower.includes("bnb") || symbolLower.includes("sol")) {
        return price / 100;
      }

      // Lower value coins
      if (symbolLower.includes("ada") || symbolLower.includes("doge")) {
        return price / 100;
      }

      // Default - assume price is in cents (divide by 100)
      return price / 100;
    },
    [normalizedSymbol]
  );

  // Initialize chart
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
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
    }
  }, [normalizedSymbol, timeframe, useMockData, chartColors, normalizePrice]);

  // Load historical data when symbol or timeframe changes
  useEffect(() => {
    setHistoricalDataLoaded(false);
    loadHistoricalData();
  }, [normalizedSymbol, timeframe, loadHistoricalData]);

  // Update chart with real-time data from WebSocket
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current || !historicalDataLoaded)
      return;

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
          `PriceChart: No candle data available for ${normalizedSymbol}`
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

      // Normalize price values
      const normalizedOpen = normalizePrice(latestCandle.open);
      const normalizedHigh = normalizePrice(latestCandle.high);
      const normalizedLow = normalizePrice(latestCandle.low);
      const normalizedClose = normalizePrice(latestCandle.close);

      // Log the update for debugging
      console.log("Updating chart with:", {
        time: candleTime,
        lastTime: lastCandleRef.current?.time,
        open: normalizedOpen,
        high: normalizedHigh,
        low: normalizedLow,
        close: normalizedClose,
        isNewCandle,
      });

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
  ]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback(
    (value: string) => {
      const newTimeframe = value as Timeframe;
      console.log(`PriceChart: Changing timeframe to ${newTimeframe}`);
      setTimeframe(newTimeframe);
      setActiveTimeframe(newTimeframe);
      subscribeToCandles(normalizedSymbol, newTimeframe);
    },
    [normalizedSymbol, setActiveTimeframe, subscribeToCandles]
  );

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
                <TabsTrigger value="1m" className="h-7 px-2 text-xs">
                  1m
                </TabsTrigger>
                <TabsTrigger value="5m" className="h-7 px-2 text-xs">
                  5m
                </TabsTrigger>
                <TabsTrigger value="15m" className="h-7 px-2 text-xs">
                  15m
                </TabsTrigger>
                <TabsTrigger value="1h" className="h-7 px-2 text-xs">
                  1h
                </TabsTrigger>
                <TabsTrigger value="1d" className="h-7 px-2 text-xs">
                  1d
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-4 relative">
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
