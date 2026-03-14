/*
  MCP resource registrations for Zebpay exchange data.
*/

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicClient } from "../public/PublicClient.js";
import { SpotClient } from "../private/SpotClient.js";
import { AppConfig } from "../config.js";
import { createInternalError } from "./errors.js";

/**
 * Registers MCP resources for Zebpay exchange data.
 * Resources provide read-only access to exchange information that can be referenced by LLMs.
 */
export function registerResources(
  server: McpServer,
  publicClient: PublicClient,
  spot: SpotClient | null,
  config: AppConfig
): void {
  // Resource: Exchange Information
  try {
    server.resource(
      "exchange-info",
      "zebpay://exchange/info",
      {
        title: "Exchange Information",
        description: "Current exchange information including available trading pairs, trading rules, order limits, and other exchange metadata. This resource is updated periodically.",
        mimeType: "application/json",
      },
      async () => {
        try {
          const data = await publicClient.getExchangeInfo();
          return {
            contents: [
              {
                uri: "zebpay://exchange/info",
                mimeType: "application/json",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createInternalError(
            `Failed to fetch exchange information: ${error instanceof Error ? error.message : String(error)}`,
            {}
          );
        }
      }
    );
    console.error("Registered resource: zebpay://exchange/info");
  } catch (error) {
    console.error("Error registering exchange-info resource:", error);
  }

  // Resource: Supported Currencies
  try {
    server.resource(
      "currencies",
      "zebpay://currencies",
      {
        title: "Supported Currencies",
        description: "List of all supported currencies and tokens on Zebpay exchange, including precision, type (crypto/fiat), withdrawal/deposit settings, supported blockchain chains, fees, and limits.",
        mimeType: "application/json",
      },
      async () => {
        try {
          const data = await publicClient.getCurrencies();
          return {
            contents: [
              {
                uri: "zebpay://currencies",
                mimeType: "application/json",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createInternalError(
            `Failed to fetch currencies: ${error instanceof Error ? error.message : String(error)}`,
            {}
          );
        }
      }
    );
    console.error("Registered resource: zebpay://currencies");
  } catch (error) {
    console.error("Error registering currencies resource:", error);
  }

  // Resource: All Tickers (Market Prices)
  try {
    server.resource(
      "all-tickers",
      "zebpay://market/tickers",
      {
        title: "All Market Tickers",
        description: "Current ticker/price information for all trading pairs on Zebpay exchange, including last price, bid/ask, 24h high/low, volume, and price changes.",
        mimeType: "application/json",
      },
      async () => {
        try {
          const data = await publicClient.getAllTickers();
          return {
            contents: [
              {
                uri: "zebpay://market/tickers",
                mimeType: "application/json",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createInternalError(
            `Failed to fetch all tickers: ${error instanceof Error ? error.message : String(error)}`,
            {}
          );
        }
      }
    );
    console.error("Registered resource: zebpay://market/tickers");
  } catch (error) {
    console.error("Error registering all-tickers resource:", error);
  }

  // Resource: User Balance (only if authenticated)
  if (spot) {
    try {
      server.resource(
        "balance",
        "zebpay://account/balance",
        {
          title: "Account Balance",
          description: "Current balance of cryptocurrencies and fiat currencies in the user's spot trading account. Shows both available and locked balances.",
          mimeType: "application/json",
        },
        async () => {
          try {
            const data = await spot.getBalance();
            return {
              contents: [
                {
                  uri: "zebpay://account/balance",
                  mimeType: "application/json",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            throw createInternalError(
              `Failed to fetch balance: ${error instanceof Error ? error.message : String(error)}`,
              {}
            );
          }
        }
      );
      console.error("Registered resource: zebpay://account/balance");
    } catch (error) {
      console.error("Error registering balance resource:", error);
    }
  }
}

