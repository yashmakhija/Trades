import axios from "axios";
import {
  AlphaVantageConfig,
  ForexRate,
  ForexDailyData,
  ForexIntradayData,
} from "../../types/alpha-vantage";
import { logger } from "../logger";

export class AlphaVantageService {
  private config: AlphaVantageConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(config: AlphaVantageConfig) {
    this.config = config;
    this.startAutoUpdate();
  }

  private startAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateExchangeRates();
    }, this.config.updateInterval);
  }

  private async updateExchangeRates(): Promise<void> {
    try {
      const key = `${this.config.defaultFromCurrency}_${this.config.defaultToCurrency}`;
      const rate = await this.getExchangeRate(
        this.config.defaultFromCurrency,
        this.config.defaultToCurrency
      );

      this.cache.set(key, {
        data: rate,
        timestamp: Date.now(),
      });

      logger.info(
        `Updated exchange rate for ${key}: ${rate["5. Exchange Rate"]}`
      );
    } catch (error) {
      logger.error("Failed to update exchange rates:", error);
    }
  }

  public async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ForexRate> {
    try {
      const response = await axios.get<ForexRate>(
        `${this.config.baseUrl}/query`,
        {
          params: {
            function: "CURRENCY_EXCHANGE_RATE",
            from_currency: fromCurrency,
            to_currency: toCurrency,
            apikey: this.config.apiKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error fetching exchange rate:", error);
      throw new Error(
        `Failed to fetch exchange rate for ${fromCurrency}/${toCurrency}`
      );
    }
  }

  public async getDailyForexData(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ForexDailyData> {
    try {
      const response = await axios.get<ForexDailyData>(
        `${this.config.baseUrl}/query`,
        {
          params: {
            function: "FX_DAILY",
            from_symbol: fromCurrency,
            to_symbol: toCurrency,
            apikey: this.config.apiKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error fetching daily forex data:", error);
      throw new Error(
        `Failed to fetch daily forex data for ${fromCurrency}/${toCurrency}`
      );
    }
  }

  public async getIntradayForexData(
    fromCurrency: string,
    toCurrency: string,
    interval: "1min" | "5min" | "15min" | "30min" | "60min" = "5min"
  ): Promise<ForexIntradayData> {
    try {
      const response = await axios.get<ForexIntradayData>(
        `${this.config.baseUrl}/query`,
        {
          params: {
            function: "FX_INTRADAY",
            from_symbol: fromCurrency,
            to_symbol: toCurrency,
            interval,
            apikey: this.config.apiKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error fetching intraday forex data:", error);
      throw new Error(
        `Failed to fetch intraday forex data for ${fromCurrency}/${toCurrency}`
      );
    }
  }

  public getCachedRate(
    fromCurrency: string,
    toCurrency: string
  ): ForexRate | null {
    const key = `${fromCurrency}_${toCurrency}`;
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if cache is still valid (less than 5 minutes old)
    if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
