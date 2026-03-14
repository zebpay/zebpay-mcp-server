/*
  Spot client for market orders.
*/

import { ZebpayAPI } from "./ZebpayAPI.js";

export interface SpotMarketOrderParams {
  symbol: string; // e.g., BTC-INR
  side: "BUY" | "SELL";
  quoteOrderAmount?: string; // Quote currency value (e.g., INR) - will be mapped to body based on side
  amount?: string; // Base currency amount (e.g., BTC) - will be mapped to body based on side
  clientOrderId?: string; // Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens, 1-36 characters
  platform?: string;
}

export interface SpotLimitOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  quoteOrderAmount?: string; // Quote currency value (e.g., INR) - will be mapped to body based on side
  amount?: string; // Base currency amount (e.g., BTC) - will be mapped to body based on side
  price: string; // Limit price as string to preserve precision
  clientOrderId?: string; // Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens, 1-36 characters
  platform?: string;
}

export interface GetOrdersParams {
  symbol: string; // Trading pair symbol (required)
  status?: "ACTIVE" | "FILLED" | "CANCELLED"; // Order status (default: ACTIVE)
  currentPage?: number; // Current page number (default: 1)
  pageSize?: number; // Number of records per page (default: 20)
  startTime?: number; // Start time in milliseconds
  endTime?: number; // End time in milliseconds
}

export interface GetExchangeFeeParams {
  symbol: string; // Trading pair symbol (required)
  side: "BUY" | "SELL"; // Order side (required)
}

export class SpotClient {
  constructor(private readonly api: ZebpayAPI) {}

  async placeMarketOrder(params: SpotMarketOrderParams): Promise<unknown> {
    const path = "/ex/orders";
    
    // Build body based on order side:
    // BUY orders: use quoteOrderAmount (value in quote currency, e.g., INR)
    // SELL orders: use amount (quantity in base currency, e.g., BTC)
    const body: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
      type: "MARKET",
    };
    
    // Map to the appropriate field based on side
    if (params.side === "BUY") {
      // For BUY orders, use quoteOrderAmount in body
      if (params.quoteOrderAmount) {
        body.quoteOrderAmount = params.quoteOrderAmount;
      } else if (params.amount) {
        // If amount is provided for BUY, it should already be converted to quoteOrderAmount by the tool
        body.quoteOrderAmount = params.amount;
      }
    } else {
      // For SELL orders, use amount in body
      if (params.amount) {
        body.amount = params.amount;
      } else if (params.quoteOrderAmount) {
        // If quoteOrderAmount is provided for SELL, it should already be converted to amount by the tool
        body.amount = params.quoteOrderAmount;
      }
    }
    
    if (params.clientOrderId) {
      body.clientOrderId = params.clientOrderId;
    }
    
    if (params.platform) {
      body.platform = params.platform;
    }
    
    return this.api.request({
      method: "POST",
      path,
      body,
      useFutures: false,
    });
  }

  async placeLimitOrder(params: SpotLimitOrderParams): Promise<unknown> {
    const path = "/ex/orders";
    
    // Build body based on order side:
    // BUY orders: use quoteOrderAmount (value in quote currency, e.g., INR)
    // SELL orders: use amount (quantity in base currency, e.g., BTC)
    const body: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
      type: "LIMIT",
      price: params.price,
    };
    
    // Map to the appropriate field based on side
    if (params.side === "BUY") {
      // For BUY orders, use quoteOrderAmount in body
      if (params.quoteOrderAmount) {
        body.quoteOrderAmount = params.quoteOrderAmount;
      } else if (params.amount) {
        // If amount is provided for BUY, it should already be converted to quoteOrderAmount by the tool
        body.quoteOrderAmount = params.amount;
      }
    } else {
      // For SELL orders, use amount in body
      if (params.amount) {
        body.amount = params.amount;
      } else if (params.quoteOrderAmount) {
        // If quoteOrderAmount is provided for SELL, it should already be converted to amount by the tool
        body.amount = params.quoteOrderAmount;
      }
    }
    
    if (params.clientOrderId) {
      body.clientOrderId = params.clientOrderId;
    }
    if (params.platform) {
      body.platform = params.platform;
    }
    return this.api.request({
      method: "POST",
      path,
      body,
      useFutures: false,
    });
  }

  async cancelOrdersBySymbol(symbol: string): Promise<unknown> {
    const path = "/ex/orders";
    return this.api.request({
      method: "DELETE",
      path,
      useFutures: false,
      queryParams: {
        symbol: symbol.toUpperCase(),
      },
    });
  }

  async cancelAllOrders(): Promise<unknown> {
    const path = "/ex/orders/cancelAll";
    return this.api.request({
      method: "DELETE",
      path,
      useFutures: false,
    });
  }

  async getOrderFills(orderId: string): Promise<unknown> {
    const path = "/ex/order/fills/";
    return this.api.request({
      method: "GET",
      path,
      useFutures: false,
      queryParams: {
        orderId,
      },
    });
  }

  async getOrderById(orderId: string): Promise<unknown> {
    const path = "/ex/order";
    return this.api.request({
      method: "GET",
      path,
      useFutures: false,
      queryParams: {
        orderId,
      },
    });
  }

  async cancelOrderById(orderId: string): Promise<unknown> {
    const path = "/ex/order";
    return this.api.request({
      method: "DELETE",
      path,
      useFutures: false,
      queryParams: {
        orderId,
      },
    });
  }

  async getBalance(currencies?: string): Promise<unknown> {
    const path = "/account/balance";
    const queryParams: Record<string, string> | undefined = currencies
      ? { currencies }
      : undefined;
    return this.api.request({
      method: "GET",
      path,
      useFutures: false,
      queryParams,
    });
  }

  async getOrders(params: GetOrdersParams): Promise<unknown> {
    const path = "/ex/orders";
    const queryParams: Record<string, string> = {
      symbol: params.symbol.toUpperCase(),
    };
    
    if (params.status) {
      queryParams.status = params.status;
    }
    if (params.currentPage !== undefined) {
      queryParams.currentPage = params.currentPage.toString();
    }
    if (params.pageSize !== undefined) {
      queryParams.pageSize = params.pageSize.toString();
    }
    if (params.startTime !== undefined) {
      queryParams.startTime = params.startTime.toString();
    }
    if (params.endTime !== undefined) {
      queryParams.endTime = params.endTime.toString();
    }
    
    return this.api.request({
      method: "GET",
      path,
      useFutures: false,
      queryParams,
    });
  }

  async getExchangeFee(params: GetExchangeFeeParams): Promise<unknown> {
    const path = `/ex/tradefee`;
    
    return this.api.request({
      method: "GET",
      path,
      useFutures: false,
      queryParams: {
        symbol: params.symbol.toUpperCase(),
        side: params.side,
      },
    });
  }
}

