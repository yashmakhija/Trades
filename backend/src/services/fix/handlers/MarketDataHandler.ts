import { EventEmitter } from "events";
import { FixMessage } from "../../../types/fix/config";
import { logger } from "../../../utils/logger";

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
}

export class MarketDataHandler extends EventEmitter {
  private marketData: Map<string, MarketData> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on("message", this.handleMessage.bind(this));
  }

  public handleMessage(message: FixMessage): void {
    try {
      // TODO: Implement actual market data message parsing
      // This is a placeholder for the actual implementation
      const marketData: MarketData = {
        symbol: message.parsedMessage.Symbol || "",
        bid: parseFloat(message.parsedMessage.BidPx) || 0,
        ask: parseFloat(message.parsedMessage.AskPx) || 0,
        last: parseFloat(message.parsedMessage.LastPx) || 0,
        volume: parseFloat(message.parsedMessage.Volume) || 0,
        timestamp: new Date(),
      };

      this.updateMarketData(marketData);
      this.emit("marketDataUpdate", marketData);
    } catch (error) {
      logger.error("Error handling market data message:", error);
    }
  }

  private updateMarketData(data: MarketData): void {
    this.marketData.set(data.symbol, data);
  }

  public getMarketData(symbol: string): MarketData | undefined {
    return this.marketData.get(symbol);
  }

  public getAllMarketData(): MarketData[] {
    return Array.from(this.marketData.values());
  }

  public getSymbols(): string[] {
    return Array.from(this.marketData.keys());
  }
}
