/*
  MCP prompt registrations for common Zebpay trading workflows.
*/

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SpotClient } from "../private/SpotClient.js";
import { PublicClient } from "../public/PublicClient.js";
import { AppConfig } from "../config.js";

/**
 * Registers MCP prompts for common Zebpay trading workflows.
 * Prompts help LLMs understand common use cases and provide structured guidance.
 */
export function registerPrompts(
  server: McpServer,
  spot: SpotClient | null,
  publicClient: PublicClient,
  config: AppConfig
): void {
  // Prompt: Check Balance Before Trading
  if (spot) {
    try {
      server.prompt(
        "check-balance-before-trade",
        "Check account balance before placing a trade to ensure sufficient funds are available. This prompt guides you through verifying balance and understanding trading requirements.",
        {
          symbol: z.string().describe(
            "Trading pair symbol in format BASE-QUOTE (e.g., 'BTC-INR', 'ETH-INR'). The symbol determines which currencies to check."
          ),
          side: z.enum(["BUY", "SELL"]).describe(
            "Order side: 'BUY' checks quote currency balance (e.g., INR for BTC-INR), 'SELL' checks base currency balance (e.g., BTC for BTC-INR)."
          ),
        },
        async ({ symbol, side }) => {
          const normalizedSymbol = symbol.trim().toUpperCase();
          const [baseCurrency, quoteCurrency] = normalizedSymbol.split("-");
          const currencyToCheck = side === "BUY" ? quoteCurrency : baseCurrency;

          return {
            description: `Check balance for ${currencyToCheck} before ${side === "BUY" ? "buying" : "selling"} ${baseCurrency}`,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `I want to ${side === "BUY" ? "buy" : "sell"} ${normalizedSymbol}. 

Please:
1. Check my ${currencyToCheck} balance using zebpay_spot_getBalance with currencies="${currencyToCheck}"
2. Get the current price of ${normalizedSymbol} using zebpay_public_getTicker with symbol="${normalizedSymbol}"
3. Calculate if I have sufficient funds for the trade
4. If sufficient, place the order using zebpay_spot_placeMarketOrder
5. If insufficient, inform me of the shortfall

For ${side === "BUY" ? "buy" : "sell"} orders, I need ${side === "BUY" ? quoteCurrency : baseCurrency} balance.`,
                },
              },
            ],
          };
        }
      );
      console.error("Registered prompt: check-balance-before-trade");
    } catch (error) {
      console.error("Error registering check-balance-before-trade prompt:", error);
    }
  }

  // Prompt: Market Analysis
  try {
    server.prompt(
      "analyze-market",
      "Perform comprehensive market analysis for a trading pair, including current price, order book depth, recent trades, and price history.",
      {
        symbol: z.string().describe(
          "Trading pair symbol in format BASE-QUOTE (e.g., 'BTC-INR', 'ETH-INR') to analyze."
        ),
      },
      async ({ symbol }) => {
        const normalizedSymbol = symbol.trim().toUpperCase();

        return {
          description: `Analyze market conditions for ${normalizedSymbol}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide a comprehensive market analysis for ${normalizedSymbol}:

1. Current Price: Use zebpay_public_getTicker with symbol="${normalizedSymbol}" to get current price and 24h statistics
2. Order Book: Use zebpay_public_getOrderBook with symbol="${normalizedSymbol}" to analyze market depth and liquidity
3. Recent Trades: Use zebpay_public_getTrades with symbol="${normalizedSymbol}" to see recent trading activity
4. Price History: Use zebpay_public_getKlines with symbol="${normalizedSymbol}" to get historical price data (you'll need to specify interval, startTime, and endTime)

Please summarize:
- Current price and 24h change
- Market depth (spread, liquidity)
- Recent trading activity
- Price trends (if historical data is available)`,
              },
            },
          ],
        };
      }
    );
    console.error("Registered prompt: analyze-market");
  } catch (error) {
    console.error("Error registering analyze-market prompt:", error);
  }

  // Prompt: Compare Multiple Trading Pairs
  try {
    server.prompt(
      "compare-trading-pairs",
      "Compare multiple trading pairs side-by-side to help make trading decisions. Shows prices, volumes, and price changes for multiple symbols.",
      {
        symbols: z.string().describe(
          "Comma-separated list of trading pair symbols (e.g., 'BTC-INR,ETH-INR,USDT-INR') to compare."
        ),
      },
      async ({ symbols }) => {
        const symbolList = symbols
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);

        return {
          description: `Compare trading pairs: ${symbolList.join(", ")}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please compare the following trading pairs: ${symbolList.join(", ")}

For each symbol, use zebpay_public_getTicker to get:
- Current price
- 24h price change (absolute and percentage)
- 24h trading volume
- 24h high and low prices

Present the comparison in a clear table format showing:
1. Symbol
2. Current Price
3. 24h Change (%)
4. 24h Volume
5. 24h High/Low

This will help me understand which pairs are most active and have the best trading opportunities.`,
              },
            },
          ],
        };
      }
    );
    console.error("Registered prompt: compare-trading-pairs");
  } catch (error) {
    console.error("Error registering compare-trading-pairs prompt:", error);
  }

  // Prompt: Get Exchange Information
  try {
    server.prompt(
      "get-exchange-info",
      "Retrieve comprehensive exchange information including available trading pairs, trading rules, order limits, and supported currencies.",
      {},
      async () => {
        return {
          description: "Get Zebpay exchange information and trading rules",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide comprehensive information about the Zebpay exchange:

1. Exchange Information: Use zebpay_public_getExchangeInfo to get:
   - Available trading pairs
   - Trading rules and limits
   - Order types supported
   - Exchange-wide settings

2. Supported Currencies: Use zebpay_public_getCurrencies to get:
   - List of all supported currencies
   - Currency details (precision, type, etc.)
   - Withdrawal/deposit settings
   - Supported blockchain chains

Please summarize:
- Total number of trading pairs
- Major trading pairs available
- Supported currencies
- Key trading rules and limits`,
              },
            },
          ],
        };
      }
    );
    console.error("Registered prompt: get-exchange-info");
  } catch (error) {
    console.error("Error registering get-exchange-info prompt:", error);
  }
}

