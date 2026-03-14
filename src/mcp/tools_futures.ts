/*
  Futures public tools
*/

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicFuturesClient } from "../public/PublicFuturesClient.js";
import { FuturesClient } from "../private/FuturesClient.js";
import { AppConfig } from "../config.js";
import { withLogging } from "./logging.js";
import { createInternalError, createInvalidParamsError } from "./errors.js";
import { formatResponse, formatOrderBookResponse, formatTickerResponse, generateCorrelationId } from "../utils/responseFormatter.js";
import { metricsCollector } from "../utils/metrics.js";

export function registerFuturesTools(
  server: McpServer,
  futuresPublicClient: PublicFuturesClient,
  futuresPrivateClient: FuturesClient | null,
  config: AppConfig
): void {
  console.error("Registering futures public tools (markets, depth, tickers)...");
  const futuresSymbolSchema = z.string().min(1).regex(/^[A-Z0-9]+$/, {
    message: 'Invalid futures symbol. Expected uppercase alphanumeric like "BTCUSDT".',
  });

  // Health check (no params)
  try {
    server.tool(
      "zebpay_futures_public_healthCheckStatus",
      `Get current health status of the Zebpay Futures public API (no auth).

When to use:
- Before making other futures requests to confirm API availability
- To troubleshoot connectivity or rate limit issues

Response:
- Returns a status payload indicating whether services are operational.
`,
      {},
      withLogging(
        "futures_public_healthCheckStatus",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getHealthCheckStatus();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_healthCheckStatus", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_healthCheckStatus", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in (error as any) ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_healthCheckStatus", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_healthCheckStatus");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_healthCheckStatus:", error);
  }
  try {
    server.tool(
      "zebpay_futures_public_getMarkets",
      `Get list of all futures markets and tradable symbols (no auth).

When to use:
- To discover available futures symbols and market metadata
- Prior to validating a user-provided symbol

Notes:
- Symbols are typically uppercase without hyphens, e.g., "BTCUSDT".
`,
      {},
      withLogging(
        "futures_public_getMarkets",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getMarkets();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getMarkets", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_getMarkets", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getMarkets", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getMarkets");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getMarkets:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getMarketInfo",
      `Get futures market info (fees, limits, min qty/price, filters) (no auth).

When to use:
- Before placing orders to understand precision, minimum quantity, and price tick size
- To validate user inputs against exchange rules
`,
      {},
      withLogging(
        "futures_public_getMarketInfo",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getMarketInfo();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getMarketInfo", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_getMarketInfo", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getMarketInfo", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getMarketInfo");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getMarketInfo:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getOrderBook",
      `Get futures order book (market depth) for a symbol (no auth).

When to use:
- To analyze bid/ask depth, spread, and liquidity for a symbol
- Before placing a limit order to choose price levels

Example:
{ "symbol": "BTCUSDT", "limit": 50 }
`,
      {
        symbol: futuresSymbolSchema.describe(`Futures symbol like "BTCUSDT" (uppercase, no hyphen).`),
        limit: z.string().optional().describe(`Optional number of price levels to return per side as string (e.g., "5", "10", "50").`),
      },
      withLogging(
        "futures_public_getOrderBook",
        config.logLevel,
        async ({ symbol, limit }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getOrderBook({ symbol: String(symbol).trim().toUpperCase(), limit: limit ? parseInt(limit, 10) : undefined });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getOrderBook", durationMs, true);
            return formatOrderBookResponse(result, { toolName: "zebpay_futures_public_getOrderBook", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getOrderBook", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getOrderBook");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getOrderBook:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getTicker24Hr",
      `Get 24h ticker statistics for a futures symbol (no auth).

Includes:
- Last price, 24h high/low, volume, price change absolute and percentage.

Example:
{ "symbol": "BTCUSDT" }
`,
      {
        symbol: futuresSymbolSchema.describe(`Futures symbol like "BTCUSDT" (uppercase, no hyphen).`),
      },
      withLogging(
        "futures_public_getTicker24Hr",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getTicker24Hr({ symbol: String(symbol).trim().toUpperCase() });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getTicker24Hr", durationMs, true);
            return formatTickerResponse(result, { correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getTicker24Hr", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getTicker24Hr");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getTicker24Hr:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getAggregateTrades",
      `Get aggregate trades (compressed recent trades) for a futures symbol (no auth).

When to use:
- To inspect recent trading activity and momentum
- For lightweight trade history without full raw trades
`,
      {
        symbol: futuresSymbolSchema.describe(`Futures symbol like "BTCUSDT" (uppercase, no hyphen).`),
        limit: z.string().optional().describe(`Optional number of trades to fetch as string (e.g., "50", "100").`),
      },
      withLogging(
        "futures_public_getAggregateTrades",
        config.logLevel,
        async ({ symbol, limit }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getAggregateTrades({ symbol: String(symbol).trim().toUpperCase(), limit: limit ? parseInt(limit, 10) : undefined });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getAggregateTrades", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_getAggregateTrades", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getAggregateTrades", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getAggregateTrades");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getAggregateTrades:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getExchangeInfo",
      `Get futures exchange info (no auth).

Includes:
- Exchange-wide settings, available symbols, filters, and rule sets.

Use with:
- zebpay_futures_public_getMarketInfo for detailed per-symbol limits.
`,
      {},
      withLogging(
        "futures_public_getExchangeInfo",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getExchangeInfo();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getExchangeInfo", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_getExchangeInfo", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getExchangeInfo", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getExchangeInfo");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getExchangeInfo:", error);
  }

  try {
    server.tool(
      "zebpay_futures_public_getExchangePairs",
      `Get futures exchange pairs (no auth).

Returns:
- List of pairs/symbols that are enabled for trading.
`,
      {},
      withLogging(
        "futures_public_getExchangePairs",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          try {
            const result = await futuresPublicClient.getExchangePairs();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_public_getExchangePairs", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_public_getExchangePairs", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_public_getExchangePairs", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_public_getExchangePairs");
  } catch (error) {
    console.error("Error registering zebpay_futures_public_getExchangePairs:", error);
  }

  // =========================
  // Authenticated futures tools
  // =========================
  console.error("Registering futures AUTHENTICATED tools...");

  // Wallet Balance (GET)
  try {
    server.tool(
      "zebpay_futures_getWalletBalance",
      `Get futures wallet balance (authentication required).

When to use:
- Before placing orders to verify available margin asset balances
- To display user account balances in a dashboard
`,
      {},
      withLogging(
        "futures_getWalletBalance",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getWalletBalance", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getWalletBalance();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getWalletBalance", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getWalletBalance", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getWalletBalance", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getWalletBalance");
  } catch (error) {
    console.error("Error registering zebpay_futures_getWalletBalance:", error);
  }

  // Place Order (POST)
  try {
    server.tool(
      "zebpay_futures_placeOrder",
      `Place a new futures trade order (authentication required).

Order types supported: MARKET, LIMIT
Sides: BUY, SELL

Notes:
- Provide price for LIMIT orders; omit price for MARKET orders.
- amount and price can be strings to preserve precision.
`,
      {
        symbol: z.string().min(1).describe(`Futures symbol, e.g., "BTCUSDT" (uppercase, no hyphen).`),
        amount: z.string().describe(`Order amount (base asset quantity) as string for precision, e.g., "0.01".`),
        side: z.enum(["BUY", "SELL"]).describe(`Order side.`),
        type: z.enum(["MARKET", "LIMIT"]).describe(`Order type.`),
        marginAsset: z.string().min(1).describe(`Margin asset used for the position, e.g., "USDT".`),
        price: z.string().optional().describe(`Price for LIMIT orders in quote asset as string. Omit for MARKET.`),
        clientOrderId: z.string().optional().describe(`Optional client-defined identifier for idempotency and tracking.`),
      },
      withLogging(
        "futures_placeOrder",
        config.logLevel,
        async ({ symbol, amount, side, type, marginAsset, price, clientOrderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_placeOrder", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.placeOrder({ symbol, amount, side, type, marginAsset, price, clientOrderId });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_placeOrder", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_placeOrder", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_placeOrder", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_placeOrder");
  } catch (error) {
    console.error("Error registering zebpay_futures_placeOrder:", error);
  }

  // Add Margin (POST)
  try {
    server.tool(
      "zebpay_futures_addMargin",
      `Add margin to a futures position (authentication required).

Use to:
- Increase margin to reduce liquidation risk or increase position buffer.
`,
      {
        symbol: z.string().min(1).describe(`Futures symbol, e.g., "BTCUSDT".`),
        amount: z.string().describe(`Amount of margin to add as string, in marginAsset.`),
        marginAsset: z.string().min(1).describe(`Margin asset, e.g., "USDT".`),
      },
      withLogging(
        "futures_addMargin",
        config.logLevel,
        async ({ symbol, amount, marginAsset }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_addMargin", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.addMargin({ symbol, amount, marginAsset });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_addMargin", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_addMargin", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_addMargin", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_addMargin");
  } catch (error) {
    console.error("Error registering zebpay_futures_addMargin:", error);
  }

  // Reduce Margin (POST)
  try {
    server.tool(
      "zebpay_futures_reduceMargin",
      `Reduce margin from a futures position (authentication required).

Use to:
- Withdraw excess margin from a position, within risk limits.
`,
      {
        symbol: z.string().min(1).describe(`Futures symbol, e.g., "BTCUSDT".`),
        amount: z.string().describe(`Amount of margin to remove as string, in marginAsset.`),
        marginAsset: z.string().min(1).describe(`Margin asset, e.g., "USDT".`),
      },
      withLogging(
        "futures_reduceMargin",
        config.logLevel,
        async ({ symbol, amount, marginAsset }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_reduceMargin", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.reduceMargin({ symbol, amount, marginAsset });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_reduceMargin", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_reduceMargin", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_reduceMargin", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_reduceMargin");
  } catch (error) {
    console.error("Error registering zebpay_futures_reduceMargin:", error);
  }

  // Open Orders (GET)
  try {
    server.tool(
      "zebpay_futures_getOpenOrders",
      `Get open futures orders (authentication required).

Filters:
- Optional symbol filter
- Optional limit and since cursor/pagination
`,
      {
        symbol: z.string().optional().describe(`Optional futures symbol to filter, e.g., "BTCUSDT".`),
        limit: z.string().optional().describe(`Optional maximum number of records to return as string.`),
        since: z.string().optional().describe(`Optional cursor or timestamp as string to fetch orders since.`),
      },
      withLogging(
        "futures_getOpenOrders",
        config.logLevel,
        async ({ symbol, limit, since }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getOpenOrders", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getOpenOrders({ symbol, limit: limit ? parseInt(limit, 10) : undefined, since });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getOpenOrders", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getOpenOrders", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getOpenOrders", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getOpenOrders");
  } catch (error) {
    console.error("Error registering zebpay_futures_getOpenOrders:", error);
  }

  // Order History (GET)
  try {
    server.tool(
      "zebpay_futures_getOrderHistory",
      `Get futures order history (authentication required).

Pagination:
- page (1-based) and pageSize (e.g., 50, 100)
`,
      {
        page: z.string().optional().describe(`Optional 1-based page number as string.`),
        pageSize: z.string().optional().describe(`Optional page size as string, e.g., "50" or "100".`),
      },
      withLogging(
        "futures_getOrderHistory",
        config.logLevel,
        async ({ page, pageSize }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getOrderHistory", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getOrderHistory({ page: page ? parseInt(page, 10) : undefined, pageSize: pageSize ? parseInt(pageSize, 10) : undefined });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getOrderHistory", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getOrderHistory", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getOrderHistory", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getOrderHistory");
  } catch (error) {
    console.error("Error registering zebpay_futures_getOrderHistory:", error);
  }

  // Linked Orders (GET)
  try {
    server.tool(
      "zebpay_futures_getLinkedOrders",
      `Get linked orders by clientOrderId (authentication required).

Use to:
- Retrieve chain of related orders created with the same clientOrderId.
`,
      { clientOrderId: z.string().min(1).describe(`Client-defined identifier used when placing orders.`) },
      withLogging(
        "futures_getLinkedOrders",
        config.logLevel,
        async ({ clientOrderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getLinkedOrders", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getLinkedOrders(clientOrderId);
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getLinkedOrders", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getLinkedOrders", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getLinkedOrders", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getLinkedOrders");
  } catch (error) {
    console.error("Error registering zebpay_futures_getLinkedOrders:", error);
  }

  // Positions (GET)
  try {
    server.tool(
      "zebpay_futures_getPositions",
      `Get futures positions (authentication required).

Filter:
- Optional status filter (e.g., "OPEN", "CLOSED") if supported by API.
`,
      { status: z.string().optional().describe(`Optional position status filter.`) },
      withLogging(
        "futures_getPositions",
        config.logLevel,
        async ({ status }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getPositions", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getPositions({ status });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getPositions", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getPositions", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getPositions", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getPositions");
  } catch (error) {
    console.error("Error registering zebpay_futures_getPositions:", error);
  }

  // Trade History (GET)
  try {
    server.tool(
      "zebpay_futures_getTradeHistory",
      `Get futures trade history (authentication required).

Pagination:
- page (1-based) and pageSize (e.g., 50, 100)
`,
      {
        page: z.string().optional().describe(`Optional 1-based page number as string.`),
        pageSize: z.string().optional().describe(`Optional page size as string, e.g., "50" or "100".`),
      },
      withLogging(
        "futures_getTradeHistory",
        config.logLevel,
        async ({ page, pageSize }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getTradeHistory", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getTradeHistory({ page: page ? parseInt(page, 10) : undefined, pageSize: pageSize ? parseInt(pageSize, 10) : undefined });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getTradeHistory", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getTradeHistory", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getTradeHistory", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getTradeHistory");
  } catch (error) {
    console.error("Error registering zebpay_futures_getTradeHistory:", error);
  }

  // Transaction History (GET)
  try {
    server.tool(
      "zebpay_futures_getTransactionHistory",
      `Get futures transaction history (authentication required).

Pagination:
- page (1-based) and pageSize (e.g., 50, 100)
`,
      {
        page: z.string().optional().describe(`Optional 1-based page number as string.`),
        pageSize: z.string().optional().describe(`Optional page size as string, e.g., "50" or "100".`),
      },
      withLogging(
        "futures_getTransactionHistory",
        config.logLevel,
        async ({ page, pageSize }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getTransactionHistory", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getTransactionHistory({ page: page ? parseInt(page, 10) : undefined, pageSize: pageSize ? parseInt(pageSize, 10) : undefined });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getTransactionHistory", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getTransactionHistory", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getTransactionHistory", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getTransactionHistory");
  } catch (error) {
    console.error("Error registering zebpay_futures_getTransactionHistory:", error);
  }

  // Delete Order (DELETE)
  try {
    server.tool(
      "zebpay_futures_deleteOrder",
      `Cancel a futures order (authentication required).

Provide either orderId or clientOrderId.
`,
      {
        orderId: z.string().optional().describe(`Order ID as string assigned by exchange.`),
        clientOrderId: z.string().optional().describe(`Client-defined identifier used when placing the order.`),
      },
      withLogging(
        "futures_deleteOrder",
        config.logLevel,
        async ({ orderId, clientOrderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_deleteOrder", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          if (!orderId && !clientOrderId) {
            throw createInvalidParamsError("Provide either orderId or clientOrderId.", {});
          }
          try {
            const result = await futuresPrivateClient.deleteOrder({ orderId, clientOrderId });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_deleteOrder", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_deleteOrder", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in (error as any) ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_deleteOrder", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_deleteOrder");
  } catch (error) {
    console.error("Error registering zebpay_futures_deleteOrder:", error);
  }

  // Get Leverage (GET)
  try {
    server.tool(
      "zebpay_futures_getUserLeverage",
      `Get user leverage for a symbol (authentication required).`,
      { symbol: z.string().min(1).describe(`Futures symbol, e.g., "BTCUSDT".`) },
      withLogging(
        "futures_getUserLeverage",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_getUserLeverage", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.getUserLeverage({ symbol });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_getUserLeverage", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_getUserLeverage", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_getUserLeverage", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_getUserLeverage");
  } catch (error) {
    console.error("Error registering zebpay_futures_getUserLeverage:", error);
  }

  // Update User Leverage (POST)
  try {
    server.tool(
      "zebpay_futures_updateUserLeverage",
      `Update user leverage for a symbol (authentication required).`,
      {
        symbol: z.string().min(1).describe(`Futures symbol, e.g., "BTCUSDT".`),
        leverage: z.string().describe(`Target leverage value as string, e.g., "5" or "10".`),
      },
      withLogging(
        "futures_updateUserLeverage",
        config.logLevel,
        async ({ symbol, leverage }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!futuresPrivateClient) {
            metricsCollector.record("zebpay_futures_updateUserLeverage", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError("API credentials are required for this operation.", {});
          }
          try {
            const result = await futuresPrivateClient.updateUserLeverage({ symbol, leverage });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_futures_updateUserLeverage", durationMs, true);
            return formatResponse(result, { toolName: "zebpay_futures_updateUserLeverage", correlationId, executionTimeMs: durationMs });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in (error as any) ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_futures_updateUserLeverage", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_futures_updateUserLeverage");
  } catch (error) {
    console.error("Error registering zebpay_futures_updateUserLeverage:", error);
  }
}


