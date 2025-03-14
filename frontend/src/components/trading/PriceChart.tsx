import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  CandlestickData as LightweightCandlestickData,
  HistogramData as LightweightHistogramData,
  ChartOptions,
  DeepPartial,
  UTCTimestamp,
  ISeriesApi,
} from "lightweight-charts";
import { useWebSocketStore, CandleData } from "@/services/websocket";
import {
  fetchHistoricalData,
  generateMockHistoricalData,
  Timeframe,
} from "@/services/marketData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PriceChartProps {
  symbol: string;
  initialTimeframe?: Timeframe;
  height?: number;
  useMockData?: boolean;
  className?: string;
}

export function PriceChart({
  symbol,
  initialTimeframe = "1h",
  height = 400,
  useMockData = false,
  className = "",
}: PriceChartProps) {
  // Refs for chart elements
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);

  // State for chart options
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [isLoading, setIsLoading] = useState(true);

  // Get WebSocket data
  const { candleData, subscribeToSymbol } = useWebSocketStore();

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart instance
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.9)",
      },
      grid: {
        vertLines: { color: "rgba(197, 203, 206, 0.1)" },
        horzLines: { color: "rgba(197, 203, 206, 0.1)" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "rgba(197, 203, 206, 0.4)",
      },
      timeScale: {
        borderColor: "rgba(197, 203, 206, 0.4)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height,
    });

    // Create candlestick series - using the new v5 API
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(38, 166, 154, 1)",
      downColor: "rgba(239, 83, 80, 1)",
      borderVisible: false,
      wickUpColor: "rgba(38, 166, 154, 1)",
      wickDownColor: "rgba(239, 83, 80, 1)",
    });

    // Create histogram series for volume - using the new v5 API
    const histogramSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(56, 33, 110, 0.3)",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    // Set scale margins for volume series
    histogramSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Save references
    chartRef.current = chart;
    candleSeries.current = candlestickSeries;
    volumeSeries.current = histogramSeries;

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Load historical data
  useEffect(() => {
    async function loadHistoricalData() {
      if (!candleSeries.current || !volumeSeries.current) return;

      setIsLoading(true);

      try {
        let historicalData: CandleData[];

        if (useMockData) {
          // Use mock data for development
          historicalData = generateMockHistoricalData(
            symbol.toLowerCase() === "btcusdt" ? 45000 : 3000,
            100
          );
        } else {
          // Fetch from API
          historicalData = await fetchHistoricalData(symbol, timeframe);

          // If no data, fall back to mock data
          if (historicalData.length === 0) {
            historicalData = generateMockHistoricalData(
              symbol.toLowerCase() === "btcusdt" ? 45000 : 3000,
              100
            );
          }
        }

        // Prepare data for chart
        const candleData: LightweightCandlestickData[] = historicalData.map(
          (candle) => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
        );

        const volumeData: LightweightHistogramData[] = historicalData.map(
          (candle) => ({
            time: candle.time as UTCTimestamp,
            value: candle.volume,
            color:
              candle.close >= candle.open
                ? "rgba(38, 166, 154, 0.5)"
                : "rgba(239, 83, 80, 0.5)",
          })
        );

        // Set data
        candleSeries.current.setData(candleData);
        volumeSeries.current.setData(volumeData);

        // Subscribe to real-time updates
        subscribeToSymbol(symbol);
      } catch (error) {
        console.error("Error loading historical data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistoricalData();
  }, [symbol, timeframe, useMockData, subscribeToSymbol]);

  // Update chart with real-time data
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current) return;

    const symbolData = candleData[symbol.toLowerCase()];

    if (!symbolData || symbolData.length === 0) return;

    // Get latest candle
    const latestCandle = symbolData[symbolData.length - 1];

    // Update candlestick series
    candleSeries.current.update({
      time: latestCandle.time as UTCTimestamp,
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
    });

    // Update volume series
    volumeSeries.current.update({
      time: latestCandle.time as UTCTimestamp,
      value: latestCandle.volume,
      color:
        latestCandle.close >= latestCandle.open
          ? "rgba(38, 166, 154, 0.5)"
          : "rgba(239, 83, 80, 0.5)",
    });
  }, [candleData, symbol]);

  // Handle timeframe change
  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as Timeframe);
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">
            {symbol.toUpperCase()} Chart
          </CardTitle>

          <Tabs
            value={timeframe}
            onValueChange={handleTimeframeChange}
            className="h-8"
          >
            <TabsList className="h-8">
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
              <TabsTrigger value="4h" className="h-7 px-2 text-xs">
                4h
              </TabsTrigger>
              <TabsTrigger value="1d" className="h-7 px-2 text-xs">
                1d
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: `${height}px` }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
