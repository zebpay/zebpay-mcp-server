/*
  TypeScript type definitions for API responses.
  These help LLMs understand the structure of tool responses.
*/

/**
 * Common response structure for order operations
 */
export interface OrderResponse {
  orderId?: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: string;
  price?: string;
  status: string;
  executedPrice?: string;
  executedQuantity?: string;
  timestamp?: number;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Balance information for a single currency
 */
export interface CurrencyBalance {
  currency: string;
  available: string;
  locked?: string;
  total?: string;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Balance response structure
 */
export interface BalanceResponse {
  balances?: CurrencyBalance[];
  currencies?: Record<string, CurrencyBalance>;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Ticker information for a trading pair
 */
export interface TickerResponse {
  symbol: string;
  lastPrice: string;
  bidPrice?: string;
  askPrice?: string;
  high24h?: string;
  low24h?: string;
  volume24h?: string;
  priceChange24h?: string;
  priceChangePercent24h?: string;
  timestamp?: number;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Order book entry
 */
export interface OrderBookEntry {
  price: string;
  quantity: string;
}

/**
 * Order book response
 */
export interface OrderBookResponse {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp?: number;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Trade information
 */
export interface TradeResponse {
  symbol: string;
  price: string;
  quantity: string;
  side: "buy" | "sell";
  timestamp: number;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Kline/Candlestick data
 */
export interface KlineResponse {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Exchange information
 */
export interface ExchangeInfoResponse {
  symbols?: Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Currency information
 */
export interface CurrencyInfo {
  currency: string;
  name?: string;
  fullName?: string;
  precision?: number;
  type?: string;
  chains?: Array<{
    chainName: string;
    withdrawalFee?: string;
    depositMinSize?: string;
    withdrawalMinSize?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown; // Allow additional fields from API
}

/**
 * Currencies response
 */
export interface CurrenciesResponse {
  currencies?: CurrencyInfo[];
  [key: string]: unknown; // Allow additional fields from API
}

