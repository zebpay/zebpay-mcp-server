/*
  Public futures client for market data (no authentication required).
*/

import { HttpClient, HttpError } from "../http/httpClient.js";
import { AppConfig } from "../config.js";
import { tickerCache, orderBookCache, exchangeInfoCache } from "../utils/cache.js";
import { convertHttpErrorToMcpError } from "../mcp/errors.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export interface FuturesSymbolParams {
  symbol: string; // e.g., "BTCUSDT"
}

export interface FuturesOrderBookParams {
  symbol: string; // e.g., "BTCUSDT"
  limit?: number; // optional depth, if supported by API in future
}

export class PublicFuturesClient {
  constructor(
    private readonly config: AppConfig,
    private readonly http: HttpClient
  ) {}

  private buildUrl(path: string, queryParams?: Record<string, string>): string {
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.config.futuresBaseUrl}${trimmed}`;
    
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
      url += `?${queryString}`;
    }
    
    return url;
  }

  private buildRootUrl(path: string): string {
    // Some endpoints (like healthCheckStatus) live at the root host, not under /api/v1
    const base = this.config.futuresBaseUrl.replace(/\/api\/v1\/?$/, "");
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    return `${base}${trimmed}`;
  }

  private async handleRequest<T = unknown>(
    requestFn: () => Promise<{ data: T }>
  ): Promise<T> {
    try {
      const response = await requestFn();
      return response.data;
    } catch (err) {
      if (err instanceof HttpError) {
        let errorMessage = err.message || "Unknown API error";
        if (err.details) {
          if (typeof err.details === "string") {
            errorMessage = err.details;
          } else if (typeof err.details === "object") {
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
      if (err instanceof McpError) {
        throw err;
      }
      throw err;
    }
  }

  // GET /healthCheckStatus (root host)
  async getHealthCheckStatus(): Promise<unknown> {
    const url = this.buildRootUrl("/healthCheckStatus");
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  // GET /api/v1/market/markets
  async getMarkets(): Promise<unknown> {
    const cacheKey = "futures:markets";
    const cached = tickerCache.get(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl("/market/markets");
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

  // GET /api/v1/market/marketInfo
  async getMarketInfo(): Promise<unknown> {
    const cacheKey = "futures:marketInfo";
    const cached = tickerCache.get(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl("/market/marketInfo");
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

  // GET /api/v1/market/orderBook?symbol=BTCUSDT
  async getOrderBook(params: FuturesOrderBookParams): Promise<unknown> {
    const symbol = params.symbol.trim().toUpperCase();
    const cacheKey = `futures:orderbook:${symbol}:${params.limit ?? "default"}`;
    const cached = orderBookCache.get(cacheKey);
    if (cached) return cached;

    const query: Record<string, string> = { symbol };
    if (params.limit !== undefined) query.limit = String(params.limit);
    const url = this.buildUrl("/market/orderBook", query);
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

  // GET /api/v1/market/ticker24Hr?symbol=BTCUSDT
  async getTicker24Hr(params: FuturesSymbolParams): Promise<unknown> {
    const symbol = params.symbol.trim().toUpperCase();
    const cacheKey = `futures:ticker24h:${symbol}`;
    const cached = tickerCache.get(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl("/market/ticker24Hr", { symbol });
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

  // GET /api/v1/market/aggTrade?symbol=BTCUSDT
  async getAggregateTrades(params: FuturesSymbolParams & { limit?: number }): Promise<unknown> {
    const symbol = params.symbol.trim().toUpperCase();
    const query: Record<string, string> = { symbol };
    if (params.limit !== undefined) query.limit = String(params.limit);

    const url = this.buildUrl("/market/aggTrade", query);
    return this.handleRequest(() =>
      this.http.request({
        method: "GET",
        url,
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      })
    );
  }

  // GET /api/v1/exchange/exchangeInfo
  async getExchangeInfo(): Promise<unknown> {
    const cacheKey = "futures:exchangeInfo";
    const cached = exchangeInfoCache.get(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl("/exchange/exchangeInfo");
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

  // GET /api/v1/exchange/pairs
  async getExchangePairs(): Promise<unknown> {
    const cacheKey = "futures:exchangePairs";
    const cached = exchangeInfoCache.get(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl("/exchange/pairs");
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
}


