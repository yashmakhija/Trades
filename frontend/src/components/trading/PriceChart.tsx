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
  Time,
} from "lightweight-charts";
import { useWebSocket, CandleData } from "@/services/websocket";
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

  const {
    candleData,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
  } = useWebSocket();

  useEffect(() => {
    const normalizedSymbol = symbol.toLowerCase();
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
    symbol,
    timeframe,
    subscribeToSymbol,
    setActiveSymbol,
    setActiveTimeframe,
    subscribeToCandles,
  ]);

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

    // The lightweight-charts library has incomplete TypeScript definitions for histogram series options
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
    } as any); // Using any is necessary due to incomplete TypeScript definitions

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
  }, [symbol, timeframe, useMockData]);

  // Update chart with real-time data from WebSocket
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current) return;

    const normalizedSymbol = symbol.toLowerCase();
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
      let candleTime: Time;
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
      } else {
        candleTime = latestCandle.time as UTCTimestamp;
      }

      console.log(
        `PriceChart: Updating chart with real-time data for ${normalizedSymbol}`
      );

      // Make sure we have valid data before updating
      if (typeof candleTime !== 'number' || isNaN(candleTime)) {
        console.warn(`PriceChart: Invalid candle time: ${candleTime}, skipping update`);
        return;
      }

      try {
        candleSeries.current.update({
          time: candleTime,
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
        });

        volumeSeries.current.update({
          time: candleTime,
          value: latestCandle.volume,
          color:
            latestCandle.close >= latestCandle.open
              ? "rgba(38, 166, 154, 0.5)"
              : "rgba(239, 83, 80, 0.5)",
        });
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
  }, [candleData, symbol, timeframe]);

  const handleTimeframeChange = (value: string) => {
    const newTimeframe = value as Timeframe;
    console.log(`PriceChart: Changing timeframe to ${newTimeframe}`);
    setTimeframe(newTimeframe);
    setActiveTimeframe(newTimeframe);
    subscribeToCandles(symbol.toLowerCase(), newTimeframe);
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">
            {symbol.toUpperCase()} Chart
          </CardTitle>
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
      </CardHeader>
      <CardContent className="p-0 pt-4">
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
