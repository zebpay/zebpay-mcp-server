/*
  Public client for market data and public endpoints (no authentication required).
*/

import { HttpClient, HttpError } from "../http/httpClient.js";
import { AppConfig } from "../config.js";
import { tickerCache, orderBookCache, exchangeInfoCache, currenciesCache } from "../utils/cache.js";
import { convertHttpErrorToMcpError } from "../mcp/errors.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export interface TickerParams {
  symbol: string; // Required symbol for single ticker
}

export interface OrderBookParams {
  symbol: string; // Required symbol for order book
  limit?: number; // Optional limit for depth (default usually 100)
}

export interface OrderBookTickerParams {
  symbol: string; // Required symbol for order book ticker
}

export interface TradesParams {
  symbol: string; // Required symbol for trades
  limit?: number; // Optional limit for number of trades
  page?: number; // Optional page number for pagination
}

export interface KlineParams {
  symbol: string; // Required symbol
  interval: string; // e.g., "1m", "5m", "1h", "1d"
  startTime: number; // Required start timestamp
  endTime: number; // Required end timestamp
  limit?: number; // Optional limit
  category?: string; // Optional category (e.g., "spot")
}

export interface MarketTickerParams {
  symbol: string; // Required symbol for market ticker
  group?: string; // Optional group parameter (e.g., "singapore")
}

export interface MarketBookParams {
  symbol: string; // Required symbol for market book
  converted?: number; // Optional converted parameter (0 or 1)
}

export class PublicClient {
  constructor(
    private readonly config: AppConfig,
    private readonly http: HttpClient
  ) {}

  private buildUrl(path: string, queryParams?: Record<string, string>): string {
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.config.spotBaseUrl}${trimmed}`;
    
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
      url += `?${queryString}`;
    }
    
    return url;
  }

  private buildMarketUrl(path: string, queryParams?: Record<string, string>): string {
    // Market API uses configurable base URL from config
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.config.marketBaseUrl}${trimmed}`;
    
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
      url += `?${queryString}`;
    }
    
    return url;
  }

  /**
   * Helper method to handle HTTP requests with consistent error handling
   */
  private async handleRequest<T = unknown>(
    requestFn: () => Promise<{ data: T }>
  ): Promise<T> {
    try {
      const response = await requestFn();
      return response.data;
    } catch (err) {
      if (err instanceof HttpError) {
        // Extract error message from various possible response formats
        let errorMessage = err.message || "Unknown API error";
        
        if (err.details) {
          if (typeof err.details === "string") {
            errorMessage = err.details;
          } else if (typeof err.details === "object") {
            // Check common error response fields (in order of preference)
            const details = err.details as Record<string, unknown>;
            errorMessage = 
              (typeof details.statusDescription === "string" && details.statusDescription) ||
              (typeof details.error === "string" && details.error) ||
              (typeof details.message === "string" && details.message) ||
              (typeof details.msg === "string" && details.msg) ||
              (typeof details.errorMessage === "string" && details.errorMessage) ||
              errorMessage;
          }
        }
        
        throw convertHttpErrorToMcpError(err.status, errorMessage, err.details);
      }
      // Re-throw MCP errors as-is
      if (err instanceof McpError) {
        throw err;
      }
      // Re-throw other errors
      throw err;
    }
  }

  /**
   * Get all tickers from Zebpay API.
   * Endpoint: GET /api/v2/market/allTickers
   */
  async getAllTickers(): Promise<unknown> {
    const cacheKey = "allTickers";
    const cached = tickerCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const path = "/market/allTickers";
    const url = this.buildUrl(path);
    const data = await this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
    
    tickerCache.set(cacheKey, data);
    return data;
  }

  /**
   * Get ticker for a specific symbol from Zebpay API.
   * Endpoint: GET /api/v2/market/ticker?symbol={symbol}
   */
  async getTicker(params: TickerParams): Promise<unknown> {
    const cacheKey = `ticker:${params.symbol}`;
    const cached = tickerCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const path = "/market/ticker";
    const queryParams: Record<string, string> = {
      symbol: params.symbol,
    };
    
    const url = this.buildUrl(path, queryParams);
    const data = await this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
    
    tickerCache.set(cacheKey, data);
    return data;
  }

  async getOrderBook(params: OrderBookParams): Promise<unknown> {
    const cacheKey = `orderbook:${params.symbol}:${params.limit || "default"}`;
    const cached = orderBookCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const path = "/market/orderbook";
    const queryParams: Record<string, string> = {
      symbol: params.symbol,
    };
    if (params.limit !== undefined) {
      queryParams.limit = params.limit.toString();
    }
    
    const url = this.buildUrl(path, queryParams);
    const data = await this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
    
    orderBookCache.set(cacheKey, data);
    return data;
  }

  /**
   * Get order book ticker for a specific symbol from Zebpay API.
   * Endpoint: GET /api/v2/market/orderbook/ticker?symbol={symbol}
   */
  async getOrderBookTicker(params: OrderBookTickerParams): Promise<unknown> {
    const path = "/market/orderbook/ticker";
    const queryParams: Record<string, string> = {
      symbol: params.symbol,
    };
    
    const url = this.buildUrl(path, queryParams);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  async getTrades(params: TradesParams): Promise<unknown> {
    const path = "/market/trades";
    const queryParams: Record<string, string> = {
      symbol: params.symbol,
    };
    if (params.limit !== undefined) {
      queryParams.limit = params.limit.toString();
    }
    if (params.page !== undefined) {
      queryParams.page = params.page.toString();
    }
    
    const url = this.buildUrl(path, queryParams);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  async getKlines(params: KlineParams): Promise<unknown> {
    const path = "/market/klines";
    const queryParams: Record<string, string> = {
      symbol: params.symbol,
      interval: params.interval,
      startTime: params.startTime.toString(),
      endTime: params.endTime.toString(),
    };
    if (params.limit !== undefined) {
      queryParams.limit = params.limit.toString();
    }
    if (params.category !== undefined) {
      queryParams.category = params.category;
    }
    
    const url = this.buildUrl(path, queryParams);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  async getExchangeInfo(): Promise<unknown> {
    const cacheKey = "exchangeInfo";
    const cached = exchangeInfoCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const path = "/ex/exchangeInfo";
    const url = this.buildUrl(path);
    const data = await this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
    
    exchangeInfoCache.set(cacheKey, data);
    return data;
  }

  async getCurrencies(): Promise<unknown> {
    const cacheKey = "currencies";
    const cached = currenciesCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const path = "/ex/currencies";
    const url = this.buildUrl(path);
    const data = await this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
    
    currenciesCache.set(cacheKey, data);
    return data;
  }

  /**
   * Get market information from Zebpay market API.
   * Endpoint: GET /api/v1/market
   */
  async getMarket(): Promise<unknown> {
    const path = "";
    const url = this.buildMarketUrl(path);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  /**
   * Get ticker for a specific symbol from Zebpay market API.
   * Endpoint: GET /api/v1/market/{symbol}/ticker
   */
  async getMarketTicker(params: MarketTickerParams): Promise<unknown> {
    const path = `/${params.symbol}/ticker`;
    const queryParams: Record<string, string> | undefined = params.group
      ? { group: params.group }
      : undefined;
    const url = this.buildMarketUrl(path, queryParams);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  /**
   * Get order book for a specific symbol from Zebpay market API.
   * Endpoint: GET /api/v1/market/{symbol}/book
   */
  async getMarketBook(params: MarketBookParams): Promise<unknown> {
    const path = `/${params.symbol}/book`;
    const queryParams: Record<string, string> | undefined = params.converted !== undefined
      ? { converted: params.converted.toString() }
      : undefined;
    const url = this.buildMarketUrl(path, queryParams);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }
}

