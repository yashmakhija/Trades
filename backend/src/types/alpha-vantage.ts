export interface ForexRate {
  "1. From_Currency Code": string;
  "2. From_Currency Name": string;
  "3. To_Currency Code": string;
  "4. To_Currency Name": string;
  "5. Exchange Rate": string;
  "6. Last Refreshed": string;
  "7. Time Zone": string;
}

export interface ForexDailyData {
  "Time Series FX (Daily)": {
    [date: string]: {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
    };
  };
  "Meta Data": {
    "1. Information": string;
    "2. From Symbol": string;
    "3. To Symbol": string;
    "4. Last Refreshed": string;
    "5. Time Zone": string;
  };
}

export interface ForexIntradayData {
  "Time Series FX (5min)": {
    [timestamp: string]: {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
    };
  };
  "Meta Data": {
    "1. Information": string;
    "2. From Symbol": string;
    "3. To Symbol": string;
    "4. Last Refreshed": string;
    "5. Interval": string;
    "6. Time Zone": string;
  };
}

export interface AlphaVantageConfig {
  apiKey: string;
  baseUrl: string;
  defaultFromCurrency: string;
  defaultToCurrency: string;
  updateInterval: number; // in milliseconds
}
