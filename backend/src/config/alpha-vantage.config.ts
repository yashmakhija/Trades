import { AlphaVantageConfig } from "../types/alpha-vantage";

export const alphaVantageConfig: AlphaVantageConfig = {
  apiKey: process.env.ALPHA_VANTAGE_API_KEY || "",
  baseUrl: "https://www.alphavantage.co",
  defaultFromCurrency: "EUR",
  defaultToCurrency: "USD",
  updateInterval: 5 * 60 * 1000, // 5 minutes
};
