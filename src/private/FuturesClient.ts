/*
  Futures client for basic trading and positions.
*/

import { ZebpayAPI } from "./ZebpayAPI.js";

export class FuturesClient {
  constructor(private readonly api: ZebpayAPI) {}

  // GET /api/v1/wallet/balance
  async getWalletBalance(): Promise<unknown> {
    return this.api.request({
      method: "GET",
      path: "/wallet/balance",
      useFutures: true,
    });
  }

  // POST /api/v1/trade/order
  async placeOrder(params: {
    symbol: string;
    amount: number | string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    marginAsset: string;
    price?: number | string; // for LIMIT orders
    clientOrderId?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      symbol: params.symbol,
      amount: typeof params.amount === "string" ? params.amount : String(params.amount),
      side: params.side,
      type: params.type,
      marginAsset: params.marginAsset,
    };
    if (params.price !== undefined) body.price = typeof params.price === "string" ? params.price : String(params.price);
    if (params.clientOrderId) body.clientOrderId = params.clientOrderId;
    return this.api.request({
      method: "POST",
      path: "/trade/order",
      body,
      useFutures: true,
    });
  }

  // POST /api/v1/trade/addMargin
  async addMargin(params: { symbol: string; amount: number | string; marginAsset: string }): Promise<unknown> {
    const body = {
      symbol: params.symbol,
      amount: typeof params.amount === "string" ? params.amount : String(params.amount),
      marginAsset: params.marginAsset,
    };
    return this.api.request({
      method: "POST",
      path: "/trade/addMargin",
      body,
      useFutures: true,
    });
  }

  // POST /api/v1/trade/reduceMargin
  async reduceMargin(params: { symbol: string; amount: number | string; marginAsset: string }): Promise<unknown> {
    const body = {
      symbol: params.symbol,
      amount: typeof params.amount === "string" ? params.amount : String(params.amount),
      marginAsset: params.marginAsset,
    };
    return this.api.request({
      method: "POST",
      path: "/trade/reduceMargin",
      body,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/order/open-orders
  async getOpenOrders(params: { symbol?: string; limit?: number; since?: string | number }): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.symbol) query.symbol = params.symbol;
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.since !== undefined) query.since = String(params.since);
    return this.api.request({
      method: "GET",
      path: "/trade/order/open-orders",
      queryParams: query,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/order/history
  async getOrderHistory(params: { page?: number; pageSize?: number }): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.pageSize !== undefined) query.pageSize = String(params.pageSize);
    return this.api.request({
      method: "GET",
      path: "/trade/order/history",
      queryParams: query,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/linkedOrders/{clientOrderId}
  async getLinkedOrders(clientOrderId: string): Promise<unknown> {
    const path = `/trade/linkedOrders/${encodeURIComponent(clientOrderId)}`;
    return this.api.request({
      method: "GET",
      path,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/positions
  async getPositions(params: { status?: string } = {}): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.status) query.status = params.status;
    return this.api.request({
      method: "GET",
      path: "/trade/positions",
      queryParams: query,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/history
  async getTradeHistory(params: { page?: number; pageSize?: number }): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.pageSize !== undefined) query.pageSize = String(params.pageSize);
    return this.api.request({
      method: "GET",
      path: "/trade/history",
      queryParams: query,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/transaction/history
  async getTransactionHistory(params: { page?: number; pageSize?: number }): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.page !== undefined) query.page = String(params.page);
    if (params.pageSize !== undefined) query.pageSize = String(params.pageSize);
    return this.api.request({
      method: "GET",
      path: "/trade/transaction/history",
      queryParams: query,
      useFutures: true,
    });
  }

  // DELETE /api/v1/trade/order
  async deleteOrder(params: { orderId?: string | number; clientOrderId?: string }): Promise<unknown> {
    const query: Record<string, string> = {};
    if (params.orderId !== undefined) query.orderId = String(params.orderId);
    if (params.clientOrderId !== undefined) query.clientOrderId = params.clientOrderId;
    return this.api.request({
      method: "DELETE",
      path: "/trade/order",
      queryParams: query,
      useFutures: true,
    });
  }

  // GET /api/v1/trade/userLeverage
  async getUserLeverage(params: { symbol: string }): Promise<unknown> {
    const query: Record<string, string> = { symbol: params.symbol };
    return this.api.request({
      method: "GET",
      path: "/trade/userLeverage",
      queryParams: query,
      useFutures: true,
    });
  }

  // POST /api/v1/trade/update/userLeverage
  async updateUserLeverage(params: { symbol: string; leverage: number | string }): Promise<unknown> {
    const body = {
      symbol: params.symbol,
      leverage: typeof params.leverage === "string" ? params.leverage : String(params.leverage),
    };
    return this.api.request({
      method: "POST",
      path: "/trade/update/userLeverage",
      body,
      useFutures: true,
    });
  }
}

