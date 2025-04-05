# Alpha Vantage Integration

## Overview
This document details the integration of Alpha Vantage API for market data, technical indicators, and analytics.

## Implementation Details

### 1. Market Data Service

```typescript
// src/services/alphaVantage/marketData.ts
export class AlphaVantageMarketDataService {
  private apiKey: string;
  private baseUrl: string;
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(apiKey: string, redis: Redis) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.redis = redis;
  }

  async getIntradayData(symbol: string, interval: string): Promise<IntradayData> {
    const cacheKey = `intraday:${symbol}:${interval}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.fetchIntradayData(symbol, interval);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.CACHE_TTL);
    
    return data;
  }

  private async fetchIntradayData(symbol: string, interval: string): Promise<IntradayData> {
    const response = await axios.get(this.baseUrl, {
      params: {
        function: 'TIME_SERIES_INTRADAY',
        symbol,
        interval,
        apikey: this.apiKey,
        outputsize: 'full'
      }
    });

    return this.transformIntradayData(response.data);
  }
}
```

### 2. Technical Indicators Service

```typescript
// src/services/alphaVantage/technicalIndicators.ts
export class TechnicalIndicatorsService {
  private apiKey: string;
  private baseUrl: string;
  private redis: Redis;

  constructor(apiKey: string, redis: Redis) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.redis = redis;
  }

  async getIndicator(
    symbol: string,
    indicator: string,
    params: IndicatorParams
  ): Promise<IndicatorData> {
    const cacheKey = `indicator:${symbol}:${indicator}:${JSON.stringify(params)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.fetchIndicator(symbol, indicator, params);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
    
    return data;
  }

  private async fetchIndicator(
    symbol: string,
    indicator: string,
    params: IndicatorParams
  ): Promise<IndicatorData> {
    const response = await axios.get(this.baseUrl, {
      params: {
        function: indicator,
        symbol,
        ...params,
        apikey: this.apiKey
      }
    });

    return this.transformIndicatorData(response.data);
  }
}
```

### 3. Fundamental Data Service

```typescript
// src/services/alphaVantage/fundamentalData.ts
export class FundamentalDataService {
  private apiKey: string;
  private baseUrl: string;
  private redis: Redis;

  constructor(apiKey: string, redis: Redis) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.redis = redis;
  }

  async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    const cacheKey = `company:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.fetchCompanyOverview(symbol);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 86400);
    
    return data;
  }

  private async fetchCompanyOverview(symbol: string): Promise<CompanyOverview> {
    const response = await axios.get(this.baseUrl, {
      params: {
        function: 'OVERVIEW',
        symbol,
        apikey: this.apiKey
      }
    });

    return response.data;
  }
}
```

### 4. Market Sentiment Service

```typescript
// src/services/alphaVantage/marketSentiment.ts
export class MarketSentimentService {
  private apiKey: string;
  private baseUrl: string;
  private redis: Redis;

  constructor(apiKey: string, redis: Redis) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.redis = redis;
  }

  async getNewsSentiment(symbol: string): Promise<NewsSentiment> {
    const cacheKey = `sentiment:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this.fetchNewsSentiment(symbol);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
    
    return data;
  }

  private async fetchNewsSentiment(symbol: string): Promise<NewsSentiment> {
    const response = await axios.get(this.baseUrl, {
      params: {
        function: 'NEWS_SENTIMENT',
        tickers: symbol,
        apikey: this.apiKey
      }
    });

    return response.data;
  }
}
```

### 5. Data Synchronization Service

```typescript
// src/services/alphaVantage/dataSync.ts
export class DataSyncService {
  private marketData: AlphaVantageMarketDataService;
  private technicalIndicators: TechnicalIndicatorsService;
  private fundamentalData: FundamentalDataService;
  private timescaleDB: TimescaleDB;

  constructor(
    marketData: AlphaVantageMarketDataService,
    technicalIndicators: TechnicalIndicatorsService,
    fundamentalData: FundamentalDataService,
    timescaleDB: TimescaleDB
  ) {
    this.marketData = marketData;
    this.technicalIndicators = technicalIndicators;
    this.fundamentalData = fundamentalData;
    this.timescaleDB = timescaleDB;
  }

  async syncHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<void> {
    // Fetch historical data
    // Transform data
    // Store in TimescaleDB
  }

  async syncTechnicalIndicators(symbol: string): Promise<void> {
    // Fetch technical indicators
    // Transform data
    // Store in TimescaleDB
  }
}
```

## Rate Limiting

```typescript
// src/services/alphaVantage/rateLimiter.ts
export class AlphaVantageRateLimiter {
  private redis: Redis;
  private readonly MAX_REQUESTS = 5;
  private readonly TIME_WINDOW = 60; // 1 minute

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkRateLimit(): Promise<boolean> {
    const key = 'alpha_vantage_rate_limit';
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.TIME_WINDOW);
    }

    return current <= this.MAX_REQUESTS;
  }
}
```

## Error Handling

```typescript
// src/services/alphaVantage/errorHandler.ts
export class AlphaVantageErrorHandler {
  static handleError(error: any): void {
    if (error.response) {
      // API error
      console.error('Alpha Vantage API Error:', error.response.data);
    } else if (error.request) {
      // Network error
      console.error('Network Error:', error.message);
    } else {
      // Other error
      console.error('Error:', error.message);
    }
  }
}
```

## Configuration

```typescript
// src/config/alphaVantage.config.ts
export interface AlphaVantageConfig {
  apiKey: string;
  baseUrl: string;
  rateLimit: {
    maxRequests: number;
    timeWindow: number;
  };
  cache: {
    ttl: number;
    prefix: string;
  };
  retry: {
    maxAttempts: number;
    delay: number;
  };
}
```

## Testing

```typescript
// src/tests/alphaVantage/integration.test.ts
describe('Alpha Vantage Integration', () => {
  let marketData: AlphaVantageMarketDataService;
  let technicalIndicators: TechnicalIndicatorsService;

  beforeEach(async () => {
    // Setup test environment
  });

  afterEach(async () => {
    // Cleanup test environment
  });

  test('should fetch intraday data', async () => {
    // Test intraday data fetching
  });

  test('should fetch technical indicators', async () => {
    // Test technical indicators fetching
  });
});
```

## Deployment Considerations

1. **API Key Management**
   - Secure storage
   - Key rotation
   - Usage monitoring

2. **Caching Strategy**
   - Redis caching
   - Cache invalidation
   - Cache warming

3. **Rate Limiting**
   - Request throttling
   - Queue management
   - Fallback strategies

4. **Data Synchronization**
   - Batch processing
   - Incremental updates
   - Error recovery 