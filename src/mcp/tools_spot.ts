/*
  MCP tool registrations using the MCP SDK.
*/

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpotClient } from "../private/SpotClient.js";
import { PublicClient } from "../public/PublicClient.js";
import { AppConfig } from "../config.js";
import { withLogging } from "./logging.js";
import { validateSymbol, validateQuantity, validateClientOrderId, symbolSchema, quantitySchema } from "../validation/validators.js";
import { createInternalError, createInvalidParamsError } from "./errors.js";
import { formatResponse, formatBalanceResponse, formatTickerResponse, formatOrderResponse, formatOrderBookResponse, formatTradesResponse, formatKlinesResponse, generateCorrelationId } from "../utils/responseFormatter.js";
import { metricsCollector } from "../utils/metrics.js";

export function registerSpotTools(
  server: McpServer,
  spot: SpotClient | null, // null if no credentials provided - tools still registered but will error if called
  publicClient: PublicClient,
  config: AppConfig
): void {
  console.error(`Registering SPOT tools - Authenticated tools will check credentials at runtime`);
  
  // Always register authenticated tools - they will check credentials at runtime
  console.error("Registering authenticated tools (spot trading, balances, orders)...");
    try {
      server.tool(
        "zebpay_spot_placeMarketOrder",
      `Place a market order on Zebpay spot trading exchange with automatic currency conversion.
      
This tool executes an immediate buy or sell order at the current market price. Market orders are filled instantly at the best available price, unlike limit orders which wait for a specific price.

**When to use this tool:**
- User wants to buy or sell cryptocurrency immediately
- User needs to execute a trade quickly without waiting for a specific price
- User wants to convert one cryptocurrency to another or to fiat currency

**Important notes:**
- Market orders execute immediately at current market price
- Supports BOTH quote currency (INR) and base currency (BTC) specifications
- Automatic conversion using current market price when needed
- All quantities are trimmed to 6 decimal places
- Symbol format is typically BASE-QUOTE (e.g., BTC-INR means buying/selling Bitcoin with Indian Rupees)

**How conversion works:**

For BUY orders:
- User specifies quoteOrderAmount (100 INR) → Used directly as quoteOrderAmount
- User specifies amount (0.0001 BTC) → Converted: 0.0001 × market_price = INR value → Used as quoteOrderAmount

For SELL orders:
- User specifies amount (0.0005 BTC) → Used directly as amount
- User specifies quoteOrderAmount (200 INR) → Converted: 200 ÷ market_price = BTC quantity → Used as amount

**Example use cases:**
1. User says "Buy 100 INR worth of BTC" → Use symbol="BTC-INR", side="BUY", quoteOrderAmount="100"
2. User says "Sell 0.0005 BTC" → Use symbol="BTC-INR", side="SELL", amount="0.0005"
3. User says "Buy 0.0001 BTC" → Use symbol="BTC-INR", side="BUY", amount="0.0001" (auto-converts to INR)
4. User says "Sell 200 INR worth of BTC" → Use symbol="BTC-INR", side="SELL", quoteOrderAmount="200" (auto-converts to BTC)

**Example request (BUY with quote currency):**
{
  "symbol": "BTC-INR",
  "side": "BUY",
  "quoteOrderAmount": "100"
}
→ Body sent to API: { symbol: "BTC-INR", side: "BUY", type: "MARKET", quoteOrderAmount: "100" }

**Example request (BUY with base currency - auto-converted):**
{
  "symbol": "BTC-INR",
  "side": "BUY",
  "amount": "0.0001"
}
→ At market price 8900000: 0.0001 × 8900000 = 890 INR
→ Body sent to API: { symbol: "BTC-INR", side: "BUY", type: "MARKET", quoteOrderAmount: "890" }

**Example request (SELL with base currency):**
{
  "symbol": "BTC-INR",
  "side": "SELL",
  "amount": "0.0005"
}
→ Body sent to API: { symbol: "BTC-INR", side: "SELL", type: "MARKET", amount: "0.0005" }

**Example request (SELL with quote currency - auto-converted):**
{
  "symbol": "BTC-INR",
  "side": "SELL",
  "quoteOrderAmount": "200"
}
→ At market price 8900000: 200 ÷ 8900000 = 0.000022 BTC
→ Body sent to API: { symbol: "BTC-INR", side: "SELL", type: "MARKET", amount: "0.000022" }

**Example response:**
The tool returns order details including order ID, status, executed price, and quantity filled.

**Rate Limits:**
- Maximum 10 requests per second for authenticated endpoints
- Burst limit: 20 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- If rate limited, wait 1 second before retrying

**Related Tools:**
- Use zebpay_spot_getBalance before placing orders to check available funds
- Use zebpay_public_getTicker to check current market price before trading
- Use zebpay_public_getOrderBook to analyze market depth and liquidity`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE. 
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees), "BTC-USDT" (Bitcoin/Tether).
The symbol determines which market you're trading in. Always use uppercase currency codes separated by a hyphen.`
        ),
        side: z.enum(["BUY", "SELL"]).describe(
          `Order side determines whether you're buying or selling the base currency.
- "BUY": Purchase the base currency (e.g., buying BTC with BTC-INR pair)
- "SELL": Sell the base currency (e.g., selling BTC with BTC-INR pair)
Example: For symbol "BTC-INR", side "BUY" means buying Bitcoin with Indian Rupees.`
        ),
        quoteOrderAmount: quantitySchema.optional().describe(
          `Quote currency value as a string (use this OR amount, not both).
Use this when user specifies the order value in QUOTE currency (e.g., INR, USDT).
Examples:
- "100" for BTC-INR means 100 INR worth
- "50" for ETH-USDT means 50 USDT worth
For BUY orders: used directly in API body as quoteOrderAmount.
For SELL orders: will be converted to base currency amount using current market price.
Always provide as a string to avoid floating-point precision issues.`
        ),
        amount: quantitySchema.optional().describe(
          `Base currency amount as a string (use this OR quoteOrderAmount, not both).
Use this when user specifies the quantity in BASE currency (e.g., BTC, ETH).
Examples:
- "0.0005" for BTC-INR means 0.0005 BTC
- "0.1" for ETH-INR means 0.1 ETH
For SELL orders: used directly in API body as amount.
For BUY orders: will be converted to quote currency value using current market price.
Always provide as a string to avoid floating-point precision issues.`
        ),
        clientOrderId: z.string().min(1).max(36).optional().describe(
          `Optional custom identifier for tracking your order.
If provided, you can use this ID to reference the order later. Must be unique.
Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens, and be 1-36 characters long.
Example: "my-trade-2024-01-15-001" or "arbitrage-order-123"
If not provided, the exchange will generate an order ID automatically.`
        ),
        platform: z.string().optional().describe(
          `Optional platform identifier for the order.`
        ),
      },
      withLogging(
        "spot_placeMarketOrder",
        config.logLevel,
        async ({ symbol, side, quoteOrderAmount, amount, clientOrderId, platform }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          // Check if credentials are available
          if (!spot) {
            metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET headers or include credentials in initialization params.",
              {}
            );
          }
          
          // Validate that at least one of quoteOrderAmount or amount is provided
          if (!quoteOrderAmount && !amount) {
            metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError(
              "Either quoteOrderAmount or amount must be provided for market orders.",
              { symbol, side }
            );
          }
          
          // Validate that both are not provided
          if (quoteOrderAmount && amount) {
            metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError(
              "Cannot provide both quoteOrderAmount and amount. Please specify only one.",
              { symbol, side }
            );
          }
          
          // Additional validation with helpful error messages
          try {
            validateSymbol(symbol);
            if (quoteOrderAmount) {
              validateQuantity(quoteOrderAmount);
            }
            if (amount) {
              validateQuantity(amount);
            }
            if (clientOrderId) {
              validateClientOrderId(clientOrderId);
            }
          } catch (error) {
            // Re-throw validation errors (they're already MCP errors)
            metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          // Helper function to trim to 6 decimals
          const trimToSixDecimals = (value: string): string => {
            const num = parseFloat(value);
            // Round to 6 decimals and remove trailing zeros
            const fixed = num.toFixed(6);
            // Remove trailing zeros after decimal point, but keep at least one digit
            return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
          };
          
          let finalQuoteOrderAmount: string | undefined;
          let finalAmount: string | undefined;
          
          // Handle conversion based on side and provided parameter
          if (side === "BUY") {
            if (quoteOrderAmount) {
              // User provided quote currency (INR) - use directly
              finalQuoteOrderAmount = trimToSixDecimals(quoteOrderAmount.trim());
            } else if (amount) {
              // User provided base currency (BTC) - need to convert to quote currency (INR)
              // Get current market price
              try {
                const ticker = await publicClient.getTicker({ symbol: symbol.trim().toUpperCase() });
                const currentPrice = parseFloat((ticker as any).lastPrice || (ticker as any).price || "0");
                
                if (currentPrice === 0) {
                  throw createInternalError("Unable to fetch current market price for conversion", { symbol });
                }
                
                // Convert: amount (BTC) * price = quoteOrderAmount (INR)
                const baseAmount = parseFloat(amount.trim());
                const convertedQuoteAmount = baseAmount * currentPrice;
                finalQuoteOrderAmount = trimToSixDecimals(convertedQuoteAmount.toString());
              } catch (error) {
                metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "conversion_error");
                throw error;
              }
            }
          } else {
            // SELL order
            if (amount) {
              // User provided base currency (BTC) - use directly
              finalAmount = trimToSixDecimals(amount.trim());
            } else if (quoteOrderAmount) {
              // User provided quote currency (INR) - need to convert to base currency (BTC)
              // Get current market price
              try {
                const ticker = await publicClient.getTicker({ symbol: symbol.trim().toUpperCase() });
                const currentPrice = parseFloat((ticker as any).lastPrice || (ticker as any).price || "0");
                
                if (currentPrice === 0) {
                  throw createInternalError("Unable to fetch current market price for conversion", { symbol });
                }
                
                // Convert: quoteOrderAmount (INR) / price = amount (BTC)
                const quoteAmount = parseFloat(quoteOrderAmount.trim());
                const convertedBaseAmount = quoteAmount / currentPrice;
                finalAmount = trimToSixDecimals(convertedBaseAmount.toString());
              } catch (error) {
                metricsCollector.record("zebpay_spot_placeMarketOrder", Date.now() - startTime, false, "conversion_error");
                throw error;
              }
            }
          }
          
          const params = {
            symbol: symbol.trim().toUpperCase(),
            side,
            ...(finalQuoteOrderAmount && { quoteOrderAmount: finalQuoteOrderAmount }),
            ...(finalAmount && { amount: finalAmount }),
            ...(clientOrderId && { clientOrderId }),
            ...(platform && { platform }),
          };
          
          try {
            const result = await spot.placeMarketOrder(params);
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_placeMarketOrder", durationMs, true);
            
            return formatOrderResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_spot_placeMarketOrder", durationMs, false, errorType);
            
            // Re-throw MCP errors as-is, wrap others
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to place market order: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, side, quoteOrderAmount, amount }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_placeMarketOrder");
  } catch (error) {
    console.error("Error registering spot_placeMarketOrder:", error);
  }

  // Limit order
  try {
    server.tool(
      "zebpay_spot_placeLimitOrder",
      `Place a LIMIT order on Zebpay spot exchange with automatic currency conversion.

Use this to buy or sell at a specific price. The order rests on the order book until it can be filled at the specified price or better.

**Important notes:**
- Supports BOTH quote currency (INR) and base currency (BTC) specifications
- Automatic conversion using the provided limit price when needed
- All quantities are trimmed to 6 decimal places
- You must specify EITHER quoteOrderAmount OR amount (not both)

**How conversion works:**

For BUY orders:
- User specifies quoteOrderAmount (100 INR) → Used directly as quoteOrderAmount
- User specifies amount (0.0001 BTC) → Converted: 0.0001 × limit_price = INR value → Used as quoteOrderAmount

For SELL orders:
- User specifies amount (0.0005 BTC) → Used directly as amount
- User specifies quoteOrderAmount (200 INR) → Converted: 200 ÷ limit_price = BTC quantity → Used as amount

**Example use cases:**
1. User says "Buy 100 INR worth of BTC at 6000000" → Use quoteOrderAmount="100", price="6000000"
2. User says "Sell 0.0005 BTC at 6000000" → Use amount="0.0005", price="6000000"
3. User says "Buy 0.0001 BTC at 6000000" → Use amount="0.0001", price="6000000" (auto-converts to INR)
4. User says "Sell 200 INR worth at 6000000" → Use quoteOrderAmount="200", price="6000000" (auto-converts to BTC)

**Example:**
{
  "symbol": "BTC-INR",
  "side": "BUY",
  "quoteOrderAmount": "100",
  "price": "6000000",
  "clientOrderId": "my-limit-1"
}
→ Body sent to API: { symbol: "BTC-INR", side: "BUY", type: "LIMIT", quoteOrderAmount: "100", price: "6000000" }`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE, e.g., "BTC-INR", "ETH-USDT".`
        ),
        side: z.enum(["BUY", "SELL"]).describe(
          `Order side determines whether you're buying or selling the base currency.
- "BUY": Purchase the base currency at the specified limit price
- "SELL": Sell the base currency at the specified limit price`
        ),
        quoteOrderAmount: quantitySchema.optional().describe(
          `Quote currency value as a string (use this OR amount, not both).
Use this when user specifies the order value in QUOTE currency (e.g., INR, USDT).
Examples:
- "100" for BTC-INR means 100 INR worth
- "50" for ETH-USDT means 50 USDT worth
For BUY orders: used directly in API body as quoteOrderAmount.
For SELL orders: will be converted to base currency amount using the provided limit price.
Always provide as a string to avoid floating-point precision issues.`
        ),
        amount: quantitySchema.optional().describe(
          `Base currency amount as a string (use this OR quoteOrderAmount, not both).
Use this when user specifies the quantity in BASE currency (e.g., BTC, ETH).
Examples:
- "0.001" for BTC-INR means 0.001 BTC
- "0.1" for ETH-INR means 0.1 ETH
For SELL orders: used directly in API body as amount.
For BUY orders: will be converted to quote currency value using the provided limit price.
Always provide as a string to avoid floating-point precision issues.`
        ),
        price: quantitySchema.describe(
          `Limit price as a string in quote currency.
This is the price at which you want to buy or sell.
Example: "6000000" means 60,00,000 INR for BTC-INR pair.
Always provide as a string to preserve precision.`
        ),
        clientOrderId: z.string().min(1).max(36).optional().describe(
          `Optional custom identifier for tracking your order.
Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens, and be 1-36 characters long.
Example: "my-limit-order-123"`
        ),
        platform: z.string().optional().describe(
          `Optional platform identifier for the order.`
        ),
      },
      withLogging(
        "spot_placeLimitOrder",
        config.logLevel,
        async ({ symbol, side, quoteOrderAmount, amount, price, clientOrderId, platform }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();

          if (!spot) {
            metricsCollector.record("zebpay_spot_placeLimitOrder", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }

          // Validate that at least one of quoteOrderAmount or amount is provided
          if (!quoteOrderAmount && !amount) {
            metricsCollector.record("zebpay_spot_placeLimitOrder", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError(
              "Either quoteOrderAmount or amount must be provided for limit orders.",
              { symbol, side }
            );
          }
          
          // Validate that both are not provided
          if (quoteOrderAmount && amount) {
            metricsCollector.record("zebpay_spot_placeLimitOrder", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError(
              "Cannot provide both quoteOrderAmount and amount. Please specify only one.",
              { symbol, side }
            );
          }

          try {
            validateSymbol(symbol);
            validateQuantity(price);
            if (quoteOrderAmount) {
              validateQuantity(quoteOrderAmount);
            }
            if (amount) {
              validateQuantity(amount);
            }
            if (clientOrderId) {
              validateClientOrderId(clientOrderId);
            }
          } catch (error) {
            metricsCollector.record("zebpay_spot_placeLimitOrder", Date.now() - startTime, false, "validation_error");
            throw error;
          }

          // Helper function to trim to 6 decimals
          const trimToSixDecimals = (value: string): string => {
            const num = parseFloat(value);
            // Round to 6 decimals and remove trailing zeros
            const fixed = num.toFixed(6);
            // Remove trailing zeros after decimal point, but keep at least one digit
            return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
          };

          let finalQuoteOrderAmount: string | undefined;
          let finalAmount: string | undefined;
          
          const limitPrice = parseFloat(price.trim());
          
          if (limitPrice === 0) {
            metricsCollector.record("zebpay_spot_placeLimitOrder", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError("Price must be greater than 0", { symbol, side, price });
          }
          
          // Handle conversion based on side and provided parameter
          if (side === "BUY") {
            if (quoteOrderAmount) {
              // User provided quote currency (INR) - use directly
              finalQuoteOrderAmount = trimToSixDecimals(quoteOrderAmount.trim());
            } else if (amount) {
              // User provided base currency (BTC) - convert to quote currency (INR) using limit price
              const baseAmount = parseFloat(amount.trim());
              const convertedQuoteAmount = baseAmount * limitPrice;
              finalQuoteOrderAmount = trimToSixDecimals(convertedQuoteAmount.toString());
            }
          } else {
            // SELL order
            if (amount) {
              // User provided base currency (BTC) - use directly
              finalAmount = trimToSixDecimals(amount.trim());
            } else if (quoteOrderAmount) {
              // User provided quote currency (INR) - convert to base currency (BTC) using limit price
              const quoteAmount = parseFloat(quoteOrderAmount.trim());
              const convertedBaseAmount = quoteAmount / limitPrice;
              finalAmount = trimToSixDecimals(convertedBaseAmount.toString());
            }
          }

          const params = {
            symbol: symbol.trim().toUpperCase(),
            side,
            ...(finalQuoteOrderAmount && { quoteOrderAmount: finalQuoteOrderAmount }),
            ...(finalAmount && { amount: finalAmount }),
            price: price.trim(),
            ...(clientOrderId && { clientOrderId }),
            ...(platform && { platform }),
          };

          try {
            const result = await spot.placeLimitOrder(params);
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_placeLimitOrder", durationMs, true);
            return formatOrderResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_placeLimitOrder", durationMs, false, errorType);
            if (error && typeof error === "object" && "code" in error) throw error;
            throw createInternalError(
              `Failed to place limit order: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, side, quoteOrderAmount, amount, price }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_placeLimitOrder");
  } catch (error) {
    console.error("Error registering zebpay_spot_placeLimitOrder:", error);
  }

    try {
      server.tool(
        "zebpay_spot_getBalance",
      `Fetch the user's spot trading account balance from Zebpay exchange.

This tool retrieves the current balance of cryptocurrencies and fiat currencies in the user's spot trading account. Use this before placing orders to check available funds.

**When to use this tool:**
- User asks about their account balance or available funds
- Before placing a buy order to verify sufficient funds
- User wants to check holdings of specific cryptocurrencies
- User asks "How much BTC do I have?" or "What's my balance?"

**Important notes:**
- Returns balances for all currencies by default
- Can filter to specific currencies using the currencies parameter
- Shows both available balance and any locked/held balance
- Balance is returned in the account's native format

**Example use cases:**
1. User says "Check my balance" → Call without currencies parameter to get all balances
2. User says "How much Bitcoin do I have?" → Use currencies="BTC" to filter
3. Before buying BTC → Check INR balance with currencies="INR"
4. User wants to see multiple currencies → Use currencies="BTC,ETH,INR"

**Example request (all balances):**
{}

**Example request (filtered):**
{
  "currencies": "BTC,ETH,INR"
}

**Example response:**
Returns an object with balance information including available amounts, locked amounts, and currency codes for each currency in the account.

**Rate Limits:**
- Maximum 10 requests per second for authenticated endpoints
- Burst limit: 20 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- If rate limited, wait 1 second before retrying

**Related Tools:**
- Use before zebpay_spot_placeMarketOrder to verify sufficient funds
- Use zebpay_public_getTicker to check current prices for balance calculations
- Access balance as a resource via zebpay://account/balance`,
      {
        currencies: z.string().optional().describe(
          `Optional comma-separated list of currency codes to filter the balance response.
If not provided, returns balances for all currencies in the account.
Format: "CURRENCY1,CURRENCY2,CURRENCY3" (no spaces, uppercase currency codes).
Examples: 
- "BTC" (only Bitcoin balance)
- "BTC,ETH" (Bitcoin and Ethereum balances)
- "BTC,ETH,INR" (Bitcoin, Ethereum, and Indian Rupees balances)
- undefined or omit parameter (all currencies)
Use this to get specific currency balances when the user asks about particular assets.`
        ),
      },
      withLogging(
        "zebpay_spot_getBalance",
        config.logLevel,
        async ({ currencies }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          // Check if credentials are available
          if (!spot) {
            metricsCollector.record("zebpay_spot_getBalance", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET headers or include credentials in initialization params.",
              {}
            );
          }
          
          try {
            const result = await spot.getBalance(currencies);
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_getBalance", durationMs, true);
            
            return formatBalanceResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_spot_getBalance", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_getBalance");
  } catch (error) {
    console.error("Error registering spot_getBalance:", error);
  }

  try {
    server.tool(
      "zebpay_spot_getExchangeFee",
      `Get exchange fee details for a specific trading pair and order side.

This tool retrieves the maker and taker fee rates for a specific trading pair, including GST and TDS information. Use this to understand the fees that will be applied to your trades.

**When to use this tool:**
- User wants to know the trading fees for a specific pair
- User needs to calculate the cost of a trade before placing an order
- User wants to understand maker vs taker fee rates
- User needs to check GST and TDS percentages

**Important notes:**
- Requires authentication (API credentials)
- Returns maker fee rate (for limit orders that add liquidity)
- Returns taker fee rate (for orders that take liquidity immediately)
- Fee rates are typically in percentage format
- GST and TDS information is included in the response

**Example use cases:**
1. User says "What are the fees for BTC-INR?" → Use symbol="BTC-INR", side="BUY" (or "SELL")
2. User wants to know trading costs before buying ETH → Use symbol="ETH-INR", side="BUY"

**Example request:**
{
  "symbol": "BTC-INR",
  "side": "BUY"
}

**Example response:**
Returns fee details including maker/taker fee rates, whether fees are percentage-based, GST, and TDS.

Endpoint: GET /api/v2/ex/tradefee?symbol=SYMBOL&side=SIDE`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR", "ETH-INR", "BTC-USDT".`
        ),
        side: z.enum(["BUY", "SELL"]).describe(
          `Order side (required).
- "BUY": Get fees for buy orders
- "SELL": Get fees for sell orders`
        ),
      },
      withLogging(
        "zebpay_spot_getExchangeFee",
        config.logLevel,
        async ({ symbol, side }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          if (!spot) {
            metricsCollector.record("zebpay_spot_getExchangeFee", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_spot_getExchangeFee", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await spot.getExchangeFee({
              symbol: symbol.trim().toUpperCase(),
              side,
            });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_getExchangeFee", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_getExchangeFee", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_getExchangeFee");
  } catch (error) {
    console.error("Error registering zebpay_spot_getExchangeFee:", error);
  }

  // Public API tools (always available, no credentials required)
  console.error("Registering public tools (market data, tickers, order books)...");
  try {
    server.tool(
      "zebpay_public_getAllTickers",
      `Get ticker/price information for all trading pairs on Zebpay exchange.

This tool retrieves the current market price, 24h statistics, and trading volume for all available trading pairs. No authentication required.

**When to use this tool:**
- User asks to see all market prices
- User wants to check prices for multiple trading pairs
- User says "Show me all prices" or "List all tickers"
- User wants an overview of all market data

**Important notes:**
- Returns ticker data for all trading pairs including last price, bid/ask, 24h high/low, volume
- Uses endpoint: api/v2/market/allTickers
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me all prices" → Call without parameters
2. User wants market overview → Use this tool
3. User asks "List all tickers" → Use this tool

**Example request:**
{}

**Example response:**
Returns ticker data for all trading pairs with current price, 24h statistics, trading volume, and price changes.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Public endpoints have higher rate limits than authenticated endpoints

**Related Tools:**
- Use zebpay_public_getTicker for a specific trading pair
- Use zebpay_public_getOrderBook to see market depth
- Access all tickers as a resource via zebpay://market/tickers`,
      {},
      withLogging(
        "zebpay_public_getAllTickers",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getAllTickers();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getAllTickers", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getAllTickers",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getAllTickers", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getAllTickers");
  } catch (error) {
    console.error("Error registering public_getAllTickers:", error);
  }

  try {
    server.tool(
      "zebpay_public_getTicker",
      `Get ticker/price information for a specific trading pair on Zebpay exchange.

This tool retrieves the current market price, 24h statistics, and trading volume for a specific trading pair. No authentication required.

**When to use this tool:**
- User asks about current price of a specific cryptocurrency
- User wants to check market price or price changes for a symbol
- User asks "What's the price of BTC?" or "Show me ETH price"
- User wants ticker data for a specific trading pair

**Important notes:**
- Returns ticker data including last price, bid/ask, 24h high/low, volume
- Requires a specific symbol parameter
- Uses endpoint: api/v2/market/ticker?symbol={symbol}
- No authentication required - this is public market data

**Example use cases:**
1. User says "What's the price of Bitcoin?" → Use symbol="BTC-INR"
2. User asks "How much is ETH?" → Use symbol="ETH-INR"
3. User wants BTC price → Use symbol="BTC-INR"

**Example request:**
{
  "symbol": "BTC-INR"
}

**Example response:**
Returns ticker data with current price, 24h statistics, trading volume, and price changes for the specified symbol.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Public endpoints have higher rate limits than authenticated endpoints

**Related Tools:**
- Use zebpay_public_getAllTickers to get prices for all pairs at once
- Use zebpay_public_getOrderBook to see market depth and liquidity
- Use zebpay_public_getTrades to see recent trading activity
- Use before zebpay_spot_placeMarketOrder to check current market price`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees), "BTC-USDT" (Bitcoin/Tether).
The symbol determines which market's ticker to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
      },
      withLogging(
        "zebpay_public_getTicker",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getTicker", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getTicker({ symbol: symbol.trim().toUpperCase() });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getTicker", durationMs, true);
            
            return formatTickerResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getTicker", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get ticker: ${error instanceof Error ? error.message : String(error)}`,
              { symbol }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getTicker");
  } catch (error) {
    console.error("Error registering public_getTicker:", error);
  }

  try {
    server.tool(
      "zebpay_public_getOrderBook",
      `Get order book (market depth) for a trading pair on Zebpay exchange.

This tool retrieves the current buy and sell orders (bids and asks) for a specific trading pair, showing market depth and liquidity. No authentication required.

**When to use this tool:**
- User asks about order book or market depth
- User wants to see buy/sell orders for a trading pair
- User asks "Show me the order book for BTC" or "What's the market depth?"
- Before placing a large order to check liquidity

**Important notes:**
- Shows bids (buy orders) and asks (sell orders) with prices and quantities
- Can limit the depth using the limit parameter
- Uses endpoint: api/v2/market/orderbook?symbol={symbol}&limit={limit}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me order book for BTC" → Use symbol="BTC-INR"
2. User wants to check market depth → Use symbol with optional limit
3. User asks "What are the current buy and sell orders?" → Use symbol parameter

**Example request:**
{
  "symbol": "BTC-INR",
  "limit": 10
}

**Example response:**
Returns order book data with bids (buy orders) and asks (sell orders), showing price levels and quantities at each level.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Lower limit values return faster responses

**Related Tools:**
- Use zebpay_public_getTicker to get current price summary
- Use zebpay_public_getOrderBookTicker for lightweight best bid/ask prices
- Use zebpay_public_getTrades to see recent executed trades
- Use before placing large orders to assess market liquidity`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's order book to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of price levels to return (positive integer).
**Default behavior:** If not provided, returns default depth (usually 100 levels).
**Performance:** Lower limits return fewer levels but provide faster responses.
**Examples:** 10 (top 10 bids/asks), 20 (top 20 bids/asks), 100 (full depth).
**Use case:** Use lower limits for quick overview, higher limits for detailed market depth analysis.`
        ),
      },
      withLogging(
        "zebpay_public_getOrderBook",
        config.logLevel,
        async ({ symbol, limit }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getOrderBook", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getOrderBook({ symbol: symbol.trim().toUpperCase(), limit });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getOrderBook", durationMs, true);
            
            return formatOrderBookResponse(result, {
              toolName: "zebpay_public_getOrderBook",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getOrderBook", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get order book: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, limit }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getOrderBook");
  } catch (error) {
    console.error("Error registering public_getOrderBook:", error);
  }

  try {
    server.tool(
      "zebpay_public_getOrderBookTicker",
      `Get order book ticker for a trading pair on Zebpay exchange.

This tool retrieves the best bid and ask prices (ticker) from the order book for a specific trading pair. This is a lightweight endpoint that returns only the top-of-book prices without the full order book depth. No authentication required.

**When to use this tool:**
- User asks about best bid/ask prices
- User wants to see the current best buy and sell prices
- User asks "What's the best bid and ask for BTC?" or "Show me the order book ticker"
- User wants a quick price check without full order book data

**Important notes:**
- Returns best bid (highest buy order) and best ask (lowest sell order) prices
- Lightweight endpoint - faster than full order book
- Uses endpoint: api/v2/market/orderbook/ticker?symbol={symbol}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me best bid/ask for BTC" → Use symbol="BTC-INR"
2. User wants quick price check → Use this tool instead of full order book
3. User asks "What are the current best prices?" → Use symbol parameter

**Example request:**
{
  "symbol": "BTC-INR"
}

**Example response:**
Returns order book ticker data with best bid price, best ask price, and related market information.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This is a lightweight endpoint, faster than full order book

**Related Tools:**
- Use zebpay_public_getOrderBook for full market depth
- Use zebpay_public_getTicker for comprehensive price information
- Use for quick price checks before trading`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's order book ticker to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
      },
      withLogging(
        "zebpay_public_getOrderBookTicker",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getOrderBookTicker", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getOrderBookTicker({ symbol: symbol.trim().toUpperCase() });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getOrderBookTicker", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getOrderBookTicker",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getOrderBookTicker", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get order book ticker: ${error instanceof Error ? error.message : String(error)}`,
              { symbol }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getOrderBookTicker");
  } catch (error) {
    console.error("Error registering public_getOrderBookTicker:", error);
  }

  try {
    server.tool(
      "zebpay_public_getTrades",
      `Get recent trades/transactions for a trading pair on Zebpay exchange.

This tool retrieves the most recent trades executed on the exchange for a specific trading pair, showing price, quantity, and time. Supports pagination for accessing older trades. No authentication required.

**When to use this tool:**
- User asks about recent trades or transaction history
- User wants to see recent market activity
- User asks "Show me recent BTC trades" or "What trades happened?"
- User wants to analyze trading activity
- User wants to paginate through historical trades

**Important notes:**
- Shows recent trades with price, quantity, side (buy/sell), and timestamp
- Can limit the number of trades returned per page
- Supports pagination with the page parameter
- Uses endpoint: api/v2/market/trades?symbol={symbol}&limit={limit}&page={page}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me recent BTC trades" → Use symbol="BTC-INR"
2. User wants to see market activity → Use symbol with optional limit
3. User asks "What trades happened recently?" → Use symbol parameter
4. User wants page 2 of trades → Use symbol="BTC-INR", limit=50, page=2

**Example request:**
{
  "symbol": "BTC-INR",
  "limit": 50,
  "page": 1
}

**Example response:**
Returns array of recent trades with price, quantity, side (buy/sell), and timestamp for each trade.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Use pagination (page parameter) to access historical trades efficiently

**Related Tools:**
- Use zebpay_public_getTicker to get current price summary
- Use zebpay_public_getOrderBook to see pending orders
- Use zebpay_public_getKlines for historical price analysis`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's trades to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of recent trades to return per page (positive integer).
**Default behavior:** If not provided, returns default number (usually 100 trades).
**Performance:** Lower limits return fewer trades but provide faster responses.
**Examples:** 10 (last 10 trades), 50 (last 50 trades), 100 (last 100 trades).
**Use case:** Combine with page parameter for pagination. Use lower limits for quick market activity overview.`
        ),
        page: z.number().int().positive().optional().describe(
          `Optional page number for pagination (positive integer, starts from 1).
**Default behavior:** If not provided, returns the first page of results (page 1).
**Pagination:** Use this to access older trades beyond the first page.
**Examples:** 1 (first page), 2 (second page), 3 (third page).
**Use case:** Combine with limit parameter to control how many trades per page. Use page=1 for most recent trades, higher page numbers for historical data.`
        ),
      },
      withLogging(
        "zebpay_public_getTrades",
        config.logLevel,
        async ({ symbol, limit, page }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getTrades", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getTrades({ symbol: symbol.trim().toUpperCase(), limit, page });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getTrades", durationMs, true);
            
            return formatTradesResponse(result, {
              toolName: "zebpay_public_getTrades",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getTrades", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get trades: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, limit, page }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getTrades");
  } catch (error) {
    console.error("Error registering public_getTrades:", error);
  }

  try {
    server.tool(
      "zebpay_public_getKlines",
      `Get candlestick/K-line data for a trading pair on Zebpay exchange.

This tool retrieves historical price data in candlestick format (OHLCV: Open, High, Low, Close, Volume) for charting and analysis. Requires a time range to be specified. Supports optional filtering by category. No authentication required.

**When to use this tool:**
- User asks about price history or charts
- User wants to analyze price trends over time
- User asks "Show me BTC price history" or "What was the price last week?"
- User wants candlestick data for technical analysis
- User wants spot or futures market data

**Important notes:**
- Returns OHLCV (Open, High, Low, Close, Volume) data
- Supports different time intervals (1m, 5m, 15m, 1h, 1d, etc.)
- Requires startTime and endTime to specify the time range (in seconds since epoch)
- Supports optional category parameter to specify market type (e.g., "spot")
- Uses endpoint: api/v2/market/klines?symbol={symbol}&interval={interval}&startTime={startTime}&endTime={endTime}&category={category}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me BTC price history" → Use symbol="BTC-INR", interval="1h", startTime and endTime
2. User wants daily charts → Use interval="1d" with time range
3. User asks "What was the price last week?" → Use interval="1d" with time range
4. User wants spot market data → Use category="spot"

**Example request:**
{
  "symbol": "BTC-INR",
  "interval": "15m",
  "startTime": 1756634020,
  "endTime": 1756740279,
  "category": "spot"
}

**Example response:**
Returns array of candlestick data with open, high, low, close prices and volume for each time period.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Larger time ranges may require multiple requests with pagination

**Related Tools:**
- Use zebpay_public_getTicker for current price information
- Use zebpay_public_getTrades to see recent trading activity
- Use zebpay_public_getOrderBook to analyze current market depth
- Combine with zebpay_public_getTicker for comprehensive market analysis`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's data to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        interval: z.string().min(1).describe(
          `Time interval for each candlestick (required).
Common intervals: "1m" (1 minute), "5m" (5 minutes), "15m" (15 minutes), "1h" (1 hour), "4h" (4 hours), "1d" (1 day), "1w" (1 week).
The interval determines the granularity of the price data.
Examples: "1m" for minute-by-minute data, "1d" for daily data.`
        ),
        startTime: z.number().describe(
          `Start timestamp in seconds since epoch (required).
Returns candlesticks starting from this time.
Use with endTime to get data for a specific time range.
Example: 1756634020`
        ),
        endTime: z.number().describe(
          `End timestamp in seconds since epoch (required).
Returns candlesticks up to this time.
Use with startTime to get data for a specific time range.
Example: 1756740279`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of candlesticks to return (positive integer).
**Default behavior:** If not provided, returns default number (usually 500 candlesticks).
**Performance:** Lower limits return fewer data points but provide faster responses.
**Examples:** 100 (last 100 candles), 500 (last 500 candles).
**Use case:** Use lower limits for quick price history overview, higher limits for detailed technical analysis. Consider time range (startTime/endTime) when setting limit.`
        ),
        category: z.string().optional().describe(
          `Optional category parameter to specify market type (string).
**Default behavior:** If not provided, returns default market data.
**Common values:** "spot" (spot trading market).
**Use case:** Use this to filter data by market category. For spot trading analysis, use category="spot".`
        ),
      },
      withLogging(
        "zebpay_public_getKlines",
        config.logLevel,
        async ({ symbol, interval, limit, startTime, endTime, category }) => {
          const correlationId = generateCorrelationId();
          const executionStartTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getKlines", Date.now() - executionStartTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getKlines({
              symbol: symbol.trim().toUpperCase(),
              interval,
              startTime,
              endTime,
              limit,
              category,
            });
            const durationMs = Date.now() - executionStartTime;
            metricsCollector.record("zebpay_public_getKlines", durationMs, true);
            
            return formatKlinesResponse(result, {
              toolName: "zebpay_public_getKlines",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - executionStartTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getKlines", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get klines: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, interval, startTime, endTime }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getKlines");
  } catch (error) {
    console.error("Error registering public_getKlines:", error);
  }

  try {
    server.tool(
      "zebpay_public_getExchangeInfo",
      `Get exchange information including trading rules, symbols, and filters.

This tool retrieves general information about the Zebpay exchange, including available trading pairs, trading rules, order limits, and other exchange metadata. No authentication required.

**When to use this tool:**
- User asks about available trading pairs
- User wants to know exchange rules or limits
- User asks "What pairs can I trade?" or "What are the trading rules?"
- User needs to check symbol information before trading

**Important notes:**
- Returns exchange-wide information including all trading pairs
- Includes trading rules, filters, and limits
- No authentication required - this is public exchange information

**Example use cases:**
1. User says "What pairs are available?" → Call without parameters
2. User wants to check trading rules → Call to get exchange info
3. User asks "What can I trade?" → Use this tool

**Example request:**
{}

**Example response:**
Returns exchange information including available symbols, trading rules, order limits, and other exchange metadata.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This data changes infrequently, consider caching results

**Related Tools:**
- Use zebpay_public_getCurrencies to see supported currencies
- Use zebpay_public_getAllTickers to see all available trading pairs
- Access exchange info as a resource via zebpay://exchange/info`,
      {},
      withLogging(
        "zebpay_public_getExchangeInfo",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getExchangeInfo();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getExchangeInfo", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getExchangeInfo",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getExchangeInfo", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get exchange info: ${error instanceof Error ? error.message : String(error)}`,
              {}
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getExchangeInfo");
  } catch (error) {
    console.error("Error registering public_getExchangeInfo:", error);
  }

  try {
    server.tool(
      "zebpay_public_getCurrencies",
      `Get list of supported currencies and tokens on Zebpay exchange.

This tool retrieves a comprehensive list of all supported currencies and tokens, including their details such as precision, type (crypto/fiat), withdrawal/deposit settings, supported blockchain chains, fees, and limits. No authentication required.

**When to use this tool:**
- User asks about supported currencies or tokens
- User wants to see what currencies are available
- User asks "What currencies does Zebpay support?" or "List all currencies"
- User needs to check withdrawal/deposit limits or fees
- User wants to verify if a specific currency is supported
- User needs information about supported blockchain chains for a currency

**Important notes:**
- Returns detailed information about each currency including:
  - Currency code, name, and full name
  - Precision and type (crypto/fiat)
  - Withdrawal and deposit settings
  - Supported blockchain chains with fees and limits
  - Contract addresses for tokens
  - Address validation regex patterns
- Uses endpoint: api/v2/ex/currencies
- No authentication required - this is public exchange information

**Example use cases:**
1. User says "What currencies are supported?" → Call without parameters
2. User wants to check BTC details → Use this tool to find BTC information
3. User asks "Can I deposit ETH?" → Use this tool to check ETH deposit settings
4. User wants withdrawal fees → Use this tool to see fees for each chain
5. User asks "What chains support USDT?" → Use this tool to see USDT chain details

**Example request:**
{}

**Example response:**
Returns array of currency objects with details including:
- currency: Currency code (e.g., "BTC")
- name: Currency name
- fullName: Full currency name (e.g., "Bitcoin")
- precision: Decimal precision
- type: Currency type (e.g., "crypto")
- isDebitEnabled: Whether debit is enabled
- chains: Array of supported blockchain chains with:
  - chainName: Name of the blockchain
  - withdrawalMinSize: Minimum withdrawal amount
  - depositMinSize: Minimum deposit amount
  - withdrawalFee: Fee for withdrawals
  - isWithdrawEnabled: Whether withdrawals are enabled
  - isDepositEnabled: Whether deposits are enabled
  - contractAddress: Contract address (for tokens)
  - withdrawPrecision: Withdrawal precision
  - maxWithdraw: Maximum withdrawal amount
  - maxDeposit: Maximum deposit amount
  - needTag: Whether tag/memo is required
  - chainId: Chain identifier
  - AddressRegex: Address validation regex pattern

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This data changes infrequently, consider caching results

**Related Tools:**
- Use zebpay_public_getExchangeInfo to see trading pairs and rules
- Access currencies as a resource via zebpay://currencies`,
      {},
      withLogging(
        "zebpay_public_getCurrencies",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getCurrencies();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getCurrencies", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getCurrencies",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getCurrencies", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get currencies: ${error instanceof Error ? error.message : String(error)}`,
              {}
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getCurrencies");
  } catch (error) {
    console.error("Error registering public_getCurrencies:", error);
  }

  // Spot private tools: cancel and query orders
  try {
    server.tool(
      "zebpay_spot_cancelOrdersBySymbol",
      `Cancel all open orders for a given symbol on Zebpay spot exchange.

Endpoint: DELETE /api/v2/ex/orders?symbol=SYMBOL&timestamp=...`,
      {
        symbol: symbolSchema.describe(`Trading pair symbol in format BASE-QUOTE, e.g., "BTC-INR".`),
      },
      withLogging(
        "zebpay_spot_cancelOrdersBySymbol",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!spot) {
            metricsCollector.record("zebpay_spot_cancelOrdersBySymbol", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_spot_cancelOrdersBySymbol", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          try {
            const result = await spot.cancelOrdersBySymbol(symbol.trim().toUpperCase());
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_cancelOrdersBySymbol", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_cancelOrdersBySymbol", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_cancelOrdersBySymbol");
  } catch (error) {
    console.error("Error registering zebpay_spot_cancelOrdersBySymbol:", error);
  }

  try {
    server.tool(
      "zebpay_spot_cancelAllOrders",
      `Cancel all open user orders on Zebpay spot exchange.

Endpoint: DELETE /api/v2/ex/orders/cancelAll?timestamp=...`,
      {},
      withLogging(
        "zebpay_spot_cancelAllOrders",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!spot) {
            metricsCollector.record("zebpay_spot_cancelAllOrders", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          try {
            const result = await spot.cancelAllOrders();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_cancelAllOrders", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_cancelAllOrders", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_cancelAllOrders");
  } catch (error) {
    console.error("Error registering zebpay_spot_cancelAllOrders:", error);
  }

  try {
    server.tool(
      "zebpay_spot_getOrderFills",
      `Get trade fills for a specific order.

Endpoint: GET /api/v2/ex/order/fills/?orderId=ID&timestamp=...`,
      {
        orderId: z.string().min(1).describe(`Order ID as a non-empty string.`),
      },
      withLogging(
        "zebpay_spot_getOrderFills",
        config.logLevel,
        async ({ orderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!spot) {
            metricsCollector.record("zebpay_spot_getOrderFills", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
            metricsCollector.record("zebpay_spot_getOrderFills", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError("Invalid orderId: must be a non-empty string.", { orderId });
          }
          try {
            const result = await spot.getOrderFills(orderId.trim());
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_getOrderFills", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_getOrderFills", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_getOrderFills");
  } catch (error) {
    console.error("Error registering zebpay_spot_getOrderFills:", error);
  }

  try {
    server.tool(
      "zebpay_spot_getOrders",
      `Get orders with optional filtering from Zebpay spot exchange.

This tool retrieves a list of orders based on the specified symbol and optional filters such as status, pagination, and time range.

**When to use this tool:**
- User wants to see their active, filled, or cancelled orders
- User needs to check order history for a specific trading pair
- User wants to paginate through their order list
- User needs to filter orders by time range

**Important notes:**
- The symbol parameter is required
- Default status filter is ACTIVE if not specified
- Default pagination is page 1 with 20 records per page
- Time filters (startTime, endTime) are in milliseconds
- Returns paginated results with total count information

**Example use cases:**
1. User says "Show me my active BTC orders" → Use symbol="BTC-INR", status="ACTIVE"
2. User says "Get all my filled ETH orders" → Use symbol="ETH-INR", status="FILLED"
3. User wants to see order history with pagination → Use currentPage and pageSize parameters

**Example request:**
{
  "symbol": "BTC-INR",
  "status": "ACTIVE",
  "currentPage": 1,
  "pageSize": 20
}

**Example response:**
Returns paginated order list with details including orderId, symbol, side, type, amount, price, status, filled amount, fees, and timestamps.

Endpoint: GET /api/v2/ex/orders`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR", "ETH-INR", "BTC-USDT".`
        ),
        status: z.enum(["ACTIVE", "FILLED", "CANCELLED"]).optional().describe(
          `Order status filter (optional).
- "ACTIVE": Open/pending orders
- "FILLED": Completed orders
- "CANCELLED": Cancelled orders
Default: "ACTIVE" if not specified.`
        ),
        currentPage: z.number().int().positive().optional().describe(
          `Current page number for pagination (optional).
Must be a positive integer. Default: 1.`
        ),
        pageSize: z.number().int().positive().optional().describe(
          `Number of records per page (optional).
Must be a positive integer. Default: 20.`
        ),
        startTime: z.number().int().positive().optional().describe(
          `Start time filter in milliseconds (optional).
Unix timestamp in milliseconds. Only returns orders created after this time.`
        ),
        endTime: z.number().int().positive().optional().describe(
          `End time filter in milliseconds (optional).
Unix timestamp in milliseconds. Only returns orders created before this time.`
        ),
      },
      withLogging(
        "zebpay_spot_getOrders",
        config.logLevel,
        async ({ symbol, status, currentPage, pageSize, startTime, endTime }) => {
          const correlationId = generateCorrelationId();
          const startTimeMs = Date.now();
          
          if (!spot) {
            metricsCollector.record("zebpay_spot_getOrders", Date.now() - startTimeMs, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_spot_getOrders", Date.now() - startTimeMs, false, "validation_error");
            throw error;
          }
          
          const params: any = {
            symbol: symbol.trim().toUpperCase(),
          };
          
          if (status) {
            params.status = status;
          }
          if (currentPage !== undefined) {
            params.currentPage = currentPage;
          }
          if (pageSize !== undefined) {
            params.pageSize = pageSize;
          }
          if (startTime !== undefined) {
            params.startTime = startTime;
          }
          if (endTime !== undefined) {
            params.endTime = endTime;
          }
          
          try {
            const result = await spot.getOrders(params);
            const durationMs = Date.now() - startTimeMs;
            metricsCollector.record("zebpay_spot_getOrders", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTimeMs;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_getOrders", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_getOrders");
  } catch (error) {
    console.error("Error registering zebpay_spot_getOrders:", error);
  }

  try {
    server.tool(
      "zebpay_spot_getOrderById",
      `Get order details by order ID.

Endpoint: GET /api/v2/ex/order?orderId=ID&timestamp=...`,
      {
        orderId: z.string().min(1).describe(`Order ID as a non-empty string.`),
      },
      withLogging(
        "zebpay_spot_getOrderById",
        config.logLevel,
        async ({ orderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!spot) {
            metricsCollector.record("zebpay_spot_getOrderById", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
            metricsCollector.record("zebpay_spot_getOrderById", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError("Invalid orderId: must be a non-empty string.", { orderId });
          }
          try {
            const result = await spot.getOrderById(orderId.trim());
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_getOrderById", durationMs, true);
            return formatOrderResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_getOrderById", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_getOrderById");
  } catch (error) {
    console.error("Error registering zebpay_spot_getOrderById:", error);
  }

  try {
    server.tool(
      "zebpay_spot_cancelOrderById",
      `Cancel a specific order by ID.

Endpoint: DELETE /api/v2/ex/order?orderId=ID&timestamp=...`,
      {
        orderId: z.string().min(1).describe(`Order ID as a non-empty string.`),
      },
      withLogging(
        "zebpay_spot_cancelOrderById",
        config.logLevel,
        async ({ orderId }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          if (!spot) {
            metricsCollector.record("zebpay_spot_cancelOrderById", Date.now() - startTime, false, "missing_credentials");
            throw createInvalidParamsError(
              "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET.",
              {}
            );
          }
          if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
            metricsCollector.record("zebpay_spot_cancelOrderById", Date.now() - startTime, false, "validation_error");
            throw createInvalidParamsError("Invalid orderId: must be a non-empty string.", { orderId });
          }
          try {
            const result = await spot.cancelOrderById(orderId.trim());
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_spot_cancelOrderById", durationMs, true);
            return formatResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String((error as any).code) : "unknown";
            metricsCollector.record("zebpay_spot_cancelOrderById", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_spot_cancelOrderById");
  } catch (error) {
    console.error("Error registering zebpay_spot_cancelOrderById:", error);
  }

}

/**
 * Register ONLY public Zebpay tools for market data.
 * Use this for HTTP streamable transport where you want a public-only server.
 */
export function registerPublicToolsOnly(
  server: McpServer,
  publicClient: PublicClient,
  config: AppConfig
): void {
  console.error("Registering public market-data tools...");
  try {
    server.tool(
      "zebpay_public_getAllTickers",
      `Get ticker/price information for all trading pairs on Zebpay exchange.

This tool retrieves the current market price, 24h statistics, and trading volume for all available trading pairs. No authentication required.

**When to use this tool:**
- User asks to see all market prices
- User wants to check prices for multiple trading pairs
- User says "Show me all prices" or "List all tickers"
- User wants an overview of all market data

**Important notes:**
- Returns ticker data for all trading pairs including last price, bid/ask, 24h high/low, volume
- Uses endpoint: api/v2/market/allTickers
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me all prices" → Call without parameters
2. User wants market overview → Use this tool
3. User asks "List all tickers" → Use this tool

**Example request:**
{}

**Example response:**
Returns ticker data for all trading pairs with current price, 24h statistics, trading volume, and price changes.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Public endpoints have higher rate limits than authenticated endpoints

**Related Tools:**
- Use zebpay_public_getTicker for a specific trading pair
- Use zebpay_public_getOrderBook to see market depth
- Access all tickers as a resource via zebpay://market/tickers`,
      {},
      withLogging(
        "zebpay_public_getAllTickers",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getAllTickers();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getAllTickers", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getAllTickers",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getAllTickers", durationMs, false, errorType);
            throw error;
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getAllTickers");
  } catch (error) {
    console.error("Error registering public_getAllTickers:", error);
  }

  try {
    server.tool(
      "zebpay_public_getTicker",
      `Get ticker/price information for a specific trading pair on Zebpay exchange.

This tool retrieves the current market price, 24h statistics, and trading volume for a specific trading pair. No authentication required.

**When to use this tool:**
- User asks about current price of a specific cryptocurrency
- User wants to check market price or price changes for a symbol
- User asks "What's the price of BTC?" or "Show me ETH price"
- User wants ticker data for a specific trading pair

**Important notes:**
- Returns ticker data including last price, bid/ask, 24h high/low, volume
- Requires a specific symbol parameter
- Uses endpoint: api/v2/market/ticker?symbol={symbol}
- No authentication required - this is public market data

**Example use cases:**
1. User says "What's the price of Bitcoin?" → Use symbol="BTC-INR"
2. User asks "How much is ETH?" → Use symbol="ETH-INR"
3. User wants BTC price → Use symbol="BTC-INR"

**Example request:**
{
  "symbol": "BTC-INR"
}

**Example response:**
Returns ticker data with current price, 24h statistics, trading volume, and price changes for the specified symbol.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Public endpoints have higher rate limits than authenticated endpoints

**Related Tools:**
- Use zebpay_public_getAllTickers to get prices for all pairs at once
- Use zebpay_public_getOrderBook to see market depth and liquidity
- Use zebpay_public_getTrades to see recent trading activity
- Use before zebpay_spot_placeMarketOrder to check current market price`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees), "BTC-USDT" (Bitcoin/Tether).
The symbol determines which market's ticker to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
      },
      withLogging(
        "zebpay_public_getTicker",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getTicker", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getTicker({ symbol: symbol.trim().toUpperCase() });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getTicker", durationMs, true);
            
            return formatTickerResponse(result, {
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getTicker", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get ticker: ${error instanceof Error ? error.message : String(error)}`,
              { symbol }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getTicker");
  } catch (error) {
    console.error("Error registering public_getTicker:", error);
  }

  try {
    server.tool(
      "zebpay_public_getOrderBook",
      `Get order book (market depth) for a trading pair on Zebpay exchange.

This tool retrieves the current buy and sell orders (bids and asks) for a specific trading pair, showing market depth and liquidity. No authentication required.

**When to use this tool:**
- User asks about order book or market depth
- User wants to see buy/sell orders for a trading pair
- User asks "Show me the order book for BTC" or "What's the market depth?"
- Before placing a large order to check liquidity

**Important notes:**
- Shows bids (buy orders) and asks (sell orders) with prices and quantities
- Can limit the depth using the limit parameter
- Uses endpoint: api/v2/market/orderbook?symbol={symbol}&limit={limit}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me order book for BTC" → Use symbol="BTC-INR"
2. User wants to check market depth → Use symbol with optional limit
3. User asks "What are the current buy and sell orders?" → Use symbol parameter

**Example request:**
{
  "symbol": "BTC-INR",
  "limit": 10
}

**Example response:**
Returns order book data with bids (buy orders) and asks (sell orders), showing price levels and quantities at each level.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Lower limit values return faster responses

**Related Tools:**
- Use zebpay_public_getTicker to get current price summary
- Use zebpay_public_getOrderBookTicker for lightweight best bid/ask prices
- Use zebpay_public_getTrades to see recent executed trades
- Use before placing large orders to assess market liquidity`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's order book to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of price levels to return (positive integer).
**Default behavior:** If not provided, returns default depth (usually 100 levels).
**Performance:** Lower limits return fewer levels but provide faster responses.
**Examples:** 10 (top 10 bids/asks), 20 (top 20 bids/asks), 100 (full depth).
**Use case:** Use lower limits for quick overview, higher limits for detailed market depth analysis.`
        ),
      },
      withLogging(
        "zebpay_public_getOrderBook",
        config.logLevel,
        async ({ symbol, limit }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getOrderBook", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getOrderBook({ symbol: symbol.trim().toUpperCase(), limit });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getOrderBook", durationMs, true);
            
            return formatOrderBookResponse(result, {
              toolName: "zebpay_public_getOrderBook",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getOrderBook", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get order book: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, limit }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getOrderBook");
  } catch (error) {
    console.error("Error registering public_getOrderBook:", error);
  }

  try {
    server.tool(
      "zebpay_public_getOrderBookTicker",
      `Get order book ticker for a trading pair on Zebpay exchange.

This tool retrieves the best bid and ask prices (ticker) from the order book for a specific trading pair. This is a lightweight endpoint that returns only the top-of-book prices without the full order book depth. No authentication required.

**When to use this tool:**
- User asks about best bid/ask prices
- User wants to see the current best buy and sell prices
- User asks "What's the best bid and ask for BTC?" or "Show me the order book ticker"
- User wants a quick price check without full order book data

**Important notes:**
- Returns best bid (highest buy order) and best ask (lowest sell order) prices
- Lightweight endpoint - faster than full order book
- Uses endpoint: api/v2/market/orderbook/ticker?symbol={symbol}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me best bid/ask for BTC" → Use symbol="BTC-INR"
2. User wants quick price check → Use this tool instead of full order book
3. User asks "What are the current best prices?" → Use symbol parameter

**Example request:**
{
  "symbol": "BTC-INR"
}

**Example response:**
Returns order book ticker data with best bid price, best ask price, and related market information.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This is a lightweight endpoint, faster than full order book

**Related Tools:**
- Use zebpay_public_getOrderBook for full market depth
- Use zebpay_public_getTicker for comprehensive price information
- Use for quick price checks before trading`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's order book ticker to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
      },
      withLogging(
        "zebpay_public_getOrderBookTicker",
        config.logLevel,
        async ({ symbol }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getOrderBookTicker", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getOrderBookTicker({ symbol: symbol.trim().toUpperCase() });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getOrderBookTicker", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getOrderBookTicker",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getOrderBookTicker", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get order book ticker: ${error instanceof Error ? error.message : String(error)}`,
              { symbol }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getOrderBookTicker");
  } catch (error) {
    console.error("Error registering public_getOrderBookTicker:", error);
  }

  try {
    server.tool(
      "zebpay_public_getTrades",
      `Get recent trades/transactions for a trading pair on Zebpay exchange.

This tool retrieves the most recent trades executed on the exchange for a specific trading pair, showing price, quantity, and time. Supports pagination for accessing older trades. No authentication required.

**When to use this tool:**
- User asks about recent trades or transaction history
- User wants to see recent market activity
- User asks "Show me recent BTC trades" or "What trades happened?"
- User wants to analyze trading activity
- User wants to paginate through historical trades

**Important notes:**
- Shows recent trades with price, quantity, side (buy/sell), and timestamp
- Can limit the number of trades returned per page
- Supports pagination with the page parameter
- Uses endpoint: api/v2/market/trades?symbol={symbol}&limit={limit}&page={page}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me recent BTC trades" → Use symbol="BTC-INR"
2. User wants to see market activity → Use symbol with optional limit
3. User asks "What trades happened recently?" → Use symbol parameter
4. User wants page 2 of trades → Use symbol="BTC-INR", limit=50, page=2

**Example request:**
{
  "symbol": "BTC-INR",
  "limit": 50,
  "page": 1
}

**Example response:**
Returns array of recent trades with price, quantity, side (buy/sell), and timestamp for each trade.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Use pagination (page parameter) to access historical trades efficiently

**Related Tools:**
- Use zebpay_public_getTicker to get current price summary
- Use zebpay_public_getOrderBook to see pending orders
- Use zebpay_public_getKlines for historical price analysis`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's trades to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of recent trades to return per page (positive integer).
**Default behavior:** If not provided, returns default number (usually 100 trades).
**Performance:** Lower limits return fewer trades but provide faster responses.
**Examples:** 10 (last 10 trades), 50 (last 50 trades), 100 (last 100 trades).
**Use case:** Combine with page parameter for pagination. Use lower limits for quick market activity overview.`
        ),
        page: z.number().int().positive().optional().describe(
          `Optional page number for pagination (positive integer, starts from 1).
**Default behavior:** If not provided, returns the first page of results (page 1).
**Pagination:** Use this to access older trades beyond the first page.
**Examples:** 1 (first page), 2 (second page), 3 (third page).
**Use case:** Combine with limit parameter to control how many trades per page. Use page=1 for most recent trades, higher page numbers for historical data.`
        ),
      },
      withLogging(
        "zebpay_public_getTrades",
        config.logLevel,
        async ({ symbol, limit, page }) => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getTrades", Date.now() - startTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getTrades({ symbol: symbol.trim().toUpperCase(), limit, page });
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getTrades", durationMs, true);
            
            return formatTradesResponse(result, {
              toolName: "zebpay_public_getTrades",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getTrades", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get trades: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, limit, page }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getTrades");
  } catch (error) {
    console.error("Error registering public_getTrades:", error);
  }

  try {
    server.tool(
      "zebpay_public_getKlines",
      `Get candlestick/K-line data for a trading pair on Zebpay exchange.

This tool retrieves historical price data in candlestick format (OHLCV: Open, High, Low, Close, Volume) for charting and analysis. Requires a time range to be specified. Supports optional filtering by category. No authentication required.

**When to use this tool:**
- User asks about price history or charts
- User wants to analyze price trends over time
- User asks "Show me BTC price history" or "What was the price last week?"
- User wants candlestick data for technical analysis
- User wants spot or futures market data

**Important notes:**
- Returns OHLCV (Open, High, Low, Close, Volume) data
- Supports different time intervals (1m, 5m, 15m, 1h, 1d, etc.)
- Requires startTime and endTime to specify the time range (in seconds since epoch)
- Supports optional category parameter to specify market type (e.g., "spot")
- Uses endpoint: api/v2/market/klines?symbol={symbol}&interval={interval}&startTime={startTime}&endTime={endTime}&category={category}
- No authentication required - this is public market data

**Example use cases:**
1. User says "Show me BTC price history" → Use symbol="BTC-INR", interval="1h", startTime and endTime
2. User wants daily charts → Use interval="1d" with time range
3. User asks "What was the price last week?" → Use interval="1d" with time range
4. User wants spot market data → Use category="spot"

**Example request:**
{
  "symbol": "BTC-INR",
  "interval": "15m",
  "startTime": 1756634020,
  "endTime": 1756740279,
  "category": "spot"
}

**Example response:**
Returns array of candlestick data with open, high, low, close prices and volume for each time period.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- Larger time ranges may require multiple requests with pagination

**Related Tools:**
- Use zebpay_public_getTicker for current price information
- Use zebpay_public_getTrades to see recent trading activity
- Use zebpay_public_getOrderBook to analyze current market depth
- Combine with zebpay_public_getTicker for comprehensive market analysis`,
      {
        symbol: symbolSchema.describe(
          `Trading pair symbol in format BASE-QUOTE (required).
Examples: "BTC-INR" (Bitcoin/Indian Rupees), "ETH-INR" (Ethereum/Indian Rupees).
The symbol determines which market's data to retrieve.
Always use uppercase currency codes separated by a hyphen.`
        ),
        interval: z.string().min(1).describe(
          `Time interval for each candlestick (required).
Common intervals: "1m" (1 minute), "5m" (5 minutes), "15m" (15 minutes), "1h" (1 hour), "4h" (4 hours), "1d" (1 day), "1w" (1 week).
The interval determines the granularity of the price data.
Examples: "1m" for minute-by-minute data, "1d" for daily data.`
        ),
        startTime: z.number().describe(
          `Start timestamp in seconds since epoch (required).
Returns candlesticks starting from this time.
Use with endTime to get data for a specific time range.
Example: 1756634020`
        ),
        endTime: z.number().describe(
          `End timestamp in seconds since epoch (required).
Returns candlesticks up to this time.
Use with startTime to get data for a specific time range.
Example: 1756740279`
        ),
        limit: z.number().int().positive().optional().describe(
          `Optional limit for the number of candlesticks to return (positive integer).
**Default behavior:** If not provided, returns default number (usually 500 candlesticks).
**Performance:** Lower limits return fewer data points but provide faster responses.
**Examples:** 100 (last 100 candles), 500 (last 500 candles).
**Use case:** Use lower limits for quick price history overview, higher limits for detailed technical analysis. Consider time range (startTime/endTime) when setting limit.`
        ),
        category: z.string().optional().describe(
          `Optional category parameter to specify market type (string).
**Default behavior:** If not provided, returns default market data.
**Common values:** "spot" (spot trading market).
**Use case:** Use this to filter data by market category. For spot trading analysis, use category="spot".`
        ),
      },
      withLogging(
        "zebpay_public_getKlines",
        config.logLevel,
        async ({ symbol, interval, limit, startTime, endTime, category }) => {
          const correlationId = generateCorrelationId();
          const executionStartTime = Date.now();
          
          try {
            validateSymbol(symbol);
          } catch (error) {
            metricsCollector.record("zebpay_public_getKlines", Date.now() - executionStartTime, false, "validation_error");
            throw error;
          }
          
          try {
            const result = await publicClient.getKlines({
              symbol: symbol.trim().toUpperCase(),
              interval,
              startTime,
              endTime,
              limit,
              category,
            });
            const durationMs = Date.now() - executionStartTime;
            metricsCollector.record("zebpay_public_getKlines", durationMs, true);
            
            return formatKlinesResponse(result, {
              toolName: "zebpay_public_getKlines",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - executionStartTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getKlines", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get klines: ${error instanceof Error ? error.message : String(error)}`,
              { symbol, interval, startTime, endTime }
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getKlines");
  } catch (error) {
    console.error("Error registering public_getKlines:", error);
  }

  try {
    server.tool(
      "zebpay_public_getExchangeInfo",
      `Get exchange information including trading rules, symbols, and filters.

This tool retrieves general information about the Zebpay exchange, including available trading pairs, trading rules, order limits, and other exchange metadata. No authentication required.

**When to use this tool:**
- User asks about available trading pairs
- User wants to know exchange rules or limits
- User asks "What pairs can I trade?" or "What are the trading rules?"
- User needs to check symbol information before trading

**Important notes:**
- Returns exchange-wide information including all trading pairs
- Includes trading rules, filters, and limits
- No authentication required - this is public exchange information

**Example use cases:**
1. User says "What pairs are available?" → Call without parameters
2. User wants to check trading rules → Call to get exchange info
3. User asks "What can I trade?" → Use this tool

**Example request:**
{}

**Example response:**
Returns exchange information including available symbols, trading rules, order limits, and other exchange metadata.

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This data changes infrequently, consider caching results

**Related Tools:**
- Use zebpay_public_getCurrencies to see supported currencies
- Use zebpay_public_getAllTickers to see all available trading pairs
- Access exchange info as a resource via zebpay://exchange/info`,
      {},
      withLogging(
        "zebpay_public_getExchangeInfo",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getExchangeInfo();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getExchangeInfo", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getExchangeInfo",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getExchangeInfo", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get exchange info: ${error instanceof Error ? error.message : String(error)}`,
              {}
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getExchangeInfo");
  } catch (error) {
    console.error("Error registering public_getExchangeInfo:", error);
  }

  try {
    server.tool(
      "zebpay_public_getCurrencies",
      `Get list of supported currencies and tokens on Zebpay exchange.

This tool retrieves a comprehensive list of all supported currencies and tokens, including their details such as precision, type (crypto/fiat), withdrawal/deposit settings, supported blockchain chains, fees, and limits. No authentication required.

**When to use this tool:**
- User asks about supported currencies or tokens
- User wants to see what currencies are available
- User asks "What currencies does Zebpay support?" or "List all currencies"
- User needs to check withdrawal/deposit limits or fees
- User wants to verify if a specific currency is supported
- User needs information about supported blockchain chains for a currency

**Important notes:**
- Returns detailed information about each currency including:
  - Currency code, name, and full name
  - Precision and type (crypto/fiat)
  - Withdrawal and deposit settings
  - Supported blockchain chains with fees and limits
  - Contract addresses for tokens
  - Address validation regex patterns
- Uses endpoint: api/v2/ex/currencies
- No authentication required - this is public exchange information

**Example use cases:**
1. User says "What currencies are supported?" → Call without parameters
2. User wants to check BTC details → Use this tool to find BTC information
3. User asks "Can I deposit ETH?" → Use this tool to check ETH deposit settings
4. User wants withdrawal fees → Use this tool to see fees for each chain
5. User asks "What chains support USDT?" → Use this tool to see USDT chain details

**Example request:**
{}

**Example response:**
Returns array of currency objects with details including:
- currency: Currency code (e.g., "BTC")
- name: Currency name
- fullName: Full currency name (e.g., "Bitcoin")
- precision: Decimal precision
- type: Currency type (e.g., "crypto")
- isDebitEnabled: Whether debit is enabled
- chains: Array of supported blockchain chains with:
  - chainName: Name of the blockchain
  - withdrawalMinSize: Minimum withdrawal amount
  - depositMinSize: Minimum deposit amount
  - withdrawalFee: Fee for withdrawals
  - isWithdrawEnabled: Whether withdrawals are enabled
  - isDepositEnabled: Whether deposits are enabled
  - contractAddress: Contract address (for tokens)
  - withdrawPrecision: Withdrawal precision
  - maxWithdraw: Maximum withdrawal amount
  - maxDeposit: Maximum deposit amount
  - needTag: Whether tag/memo is required
  - chainId: Chain identifier
  - AddressRegex: Address validation regex pattern

**Rate Limits:**
- Maximum 20 requests per second for public endpoints
- Burst limit: 40 requests
- Rate limit headers (X-RateLimit-*) are included in responses
- This data changes infrequently, consider caching results

**Related Tools:**
- Use zebpay_public_getExchangeInfo to see trading pairs and rules
- Access currencies as a resource via zebpay://currencies`,
      {},
      withLogging(
        "zebpay_public_getCurrencies",
        config.logLevel,
        async () => {
          const correlationId = generateCorrelationId();
          const startTime = Date.now();
          
          try {
            const result = await publicClient.getCurrencies();
            const durationMs = Date.now() - startTime;
            metricsCollector.record("zebpay_public_getCurrencies", durationMs, true);
            
            return formatResponse(result, {
              toolName: "zebpay_public_getCurrencies",
              correlationId,
              executionTimeMs: durationMs,
            });
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorType = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
            metricsCollector.record("zebpay_public_getCurrencies", durationMs, false, errorType);
            
            if (error && typeof error === "object" && "code" in error) {
              throw error;
            }
            throw createInternalError(
              `Failed to get currencies: ${error instanceof Error ? error.message : String(error)}`,
              {}
            );
          }
        }
      ),
    );
    console.error("Registered tool: zebpay_public_getCurrencies");
  } catch (error) {
    console.error("Error registering public_getCurrencies:", error);
  }
  console.error("✓ Public-only tool registration complete.");
}
