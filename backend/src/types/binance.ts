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
