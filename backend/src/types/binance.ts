export interface BinanceWebSocketMessage {
  e: string;
  E: number;
}

export interface BinanceTickerMessage extends BinanceWebSocketMessage {
  e: "ticker";
  s: string;
  p: string;
  P: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}

export interface BinanceKlineMessage extends BinanceWebSocketMessage {
  e: "kline"; // Event type
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
  };
}

export interface ProcessedTickerData {
  symbol: string;
  price: number; // Stored as integer (actual price * 100)
  priceChangePercent: number;
  volume: number;
  timestamp: number;
}

export interface BinanceSubscriptionMessage {
  method: string;
  params: string[];
  id: number;
}
