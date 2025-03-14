"use client";

import { Symbol } from "@/store/use-market-store";
import { api } from "./api";

class MarketApi {
  // Get all available symbols
  async getSymbols(): Promise<Symbol[]> {
    const response = await api.get<Symbol[]>("/symbols");
    return response.data;
  }

  // Get a specific symbol by name
  async getSymbol(name: string): Promise<Symbol> {
    const response = await api.get<Symbol>(`/symbols/${name}`);
    return response.data;
  }

  // Get price history for a symbol
  async getPriceHistory(symbolId: string, timeframe: string = "1h", limit: number = 100): Promise<any[]> {
    const response = await api.get<any[]>(`/symbols/${symbolId}/history`, {
      params: { timeframe, limit }
    });
    return response.data;
  }

  // Get latest market data for all symbols
  async getMarketData(): Promise<{ [key: string]: { price: number, change24h: number } }> {
    const response = await api.get<{ [key: string]: { price: number, change24h: number } }>("/market-data");
    return response.data;
  }
}

export const marketApi = new MarketApi();
