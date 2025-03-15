import { useEffect, useRef, useState } from "react";
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
} from "lightweight-charts";
import {
  useWebSocketStore,
  CandleData,
  websocketService,
} from "@/services/websocket";
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [isLoading, setIsLoading] = useState(true);

  const { candleData, subscribeToSymbol } = useWebSocketStore();

  useEffect(() => {
    const normalizedSymbol = symbol.toLowerCase();
    console.log(`PriceChart: Setting up for symbol ${normalizedSymbol}`);

    subscribeToSymbol(normalizedSymbol);

    websocketService.setActiveSymbol(normalizedSymbol);

    return () => {
      if (websocketService.getConnectionState() === "connected") {
        console.log(`PriceChart: Component unmounting, clearing active symbol`);
      }
    };
  }, [symbol, subscribeToSymbol]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
    }

    const options: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.9)",
      },
      grid: {
        vertLines: { color: "rgba(197, 203, 206, 0.1)" },
        horzLines: { color: "rgba(197, 203, 206, 0.1)" },
      },
      timeScale: {
        borderColor: "rgba(197, 203, 206, 0.4)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(197, 203, 206, 0.5)",
          width: 1,
          style: 1,
          visible: true,
          labelVisible: true,
        },
        horzLine: {
          color: "rgba(197, 203, 206, 0.5)",
          width: 1,
          style: 1,
          visible: true,
          labelVisible: true,
        },
        mode: 1,
      },
    };

    chartRef.current = createChart(chartContainerRef.current, {
      ...options,
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    candleSeries.current = chartRef.current.addSeries(CandlestickSeries, {
      upColor: "rgba(38, 166, 154, 1)",
      downColor: "rgba(239, 83, 80, 1)",
      borderVisible: false,
      wickUpColor: "rgba(38, 166, 154, 1)",
      wickDownColor: "rgba(239, 83, 80, 1)",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    volumeSeries.current = chartRef.current.addSeries(HistogramSeries, {
      color: "rgba(56, 33, 110, 0.3)",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      // The scaleMargins property is supported but TypeScript definitions might be incomplete
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    } as any);

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [height]);

  useEffect(() => {
    async function loadHistoricalData() {
      if (!candleSeries.current || !volumeSeries.current) return;

      setIsLoading(true);
      const normalizedSymbol = symbol.toLowerCase();

      try {
        console.log(
          `PriceChart: Loading historical data for ${normalizedSymbol} with timeframe ${timeframe}`
        );

        let historicalData: CandleData[];

        if (useMockData) {
          historicalData = generateMockHistoricalData(
            normalizedSymbol.includes("btc") ? 45000 : 2000,
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
          return;
        }

        const candleStickData = historicalData.map((candle) => ({
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));

        const volumeData = historicalData.map((candle) => ({
          time: candle.time as UTCTimestamp,
          value: candle.volume,
          color:
            candle.close >= candle.open
              ? "rgba(38, 166, 154, 0.5)"
              : "rgba(239, 83, 80, 0.5)",
        }));

        candleSeries.current.setData(candleStickData);
        volumeSeries.current.setData(volumeData);

        chartRef.current?.timeScale().fitContent();

        console.log(
          `PriceChart: Chart updated with historical data for ${normalizedSymbol}`
        );
      } catch (error) {
        console.error(
          `PriceChart: Error loading historical data for ${normalizedSymbol}:`,
          error
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadHistoricalData();
  }, [symbol, timeframe, useMockData, subscribeToSymbol]);

  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current) return;

    const normalizedSymbol = symbol.toLowerCase();
    const symbolData = candleData[normalizedSymbol];

    if (!symbolData || symbolData.length === 0) {
      return;
    }

    try {
      const latestCandle = symbolData[symbolData.length - 1];

      if (!latestCandle || typeof latestCandle.time !== "number") {
        console.warn(
          `PriceChart: Invalid candle data for ${normalizedSymbol}:`,
          latestCandle
        );
        return;
      }

      const validCandle = {
        time: latestCandle.time as UTCTimestamp,
        open: typeof latestCandle.open === "number" ? latestCandle.open : 0,
        high: typeof latestCandle.high === "number" ? latestCandle.high : 0,
        low: typeof latestCandle.low === "number" ? latestCandle.low : 0,
        close: typeof latestCandle.close === "number" ? latestCandle.close : 0,
      };

      const volume =
        typeof latestCandle.volume === "number" ? latestCandle.volume : 0;

      candleSeries.current.update(validCandle);

      volumeSeries.current.update({
        time: validCandle.time,
        value: volume,
        color:
          validCandle.close >= validCandle.open
            ? "rgba(38, 166, 154, 0.5)"
            : "rgba(239, 83, 80, 0.5)",
      });
    } catch (error) {
      console.error(
        `PriceChart: Error updating chart for ${normalizedSymbol}:`,
        error
      );
    }
  }, [candleData, symbol]);

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as Timeframe);
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="pb-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-lg font-semibold">
            {symbol.toUpperCase()} Price Chart
          </CardTitle>
          <Tabs
            value={timeframe}
            onValueChange={handleTimeframeChange}
            className="h-8"
          >
            <TabsList className="h-8">
              <TabsTrigger value="1m" className="text-xs px-2 h-6">
                1m
              </TabsTrigger>
              <TabsTrigger value="5m" className="text-xs px-2 h-6">
                5m
              </TabsTrigger>
              <TabsTrigger value="15m" className="text-xs px-2 h-6">
                15m
              </TabsTrigger>
              <TabsTrigger value="1h" className="text-xs px-2 h-6">
                1h
              </TabsTrigger>
              <TabsTrigger value="4h" className="text-xs px-2 h-6">
                4h
              </TabsTrigger>
              <TabsTrigger value="1d" className="text-xs px-2 h-6">
                1d
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-4">
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <div
            ref={chartContainerRef}
            className="w-full"
            style={{ height: `${height}px` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
