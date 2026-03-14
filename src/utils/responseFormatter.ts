/*
  Response formatting utilities for better LLM parsing and understanding.
*/

import { randomUUID } from "node:crypto";

/**
 * Generates a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Formats API response for better LLM understanding
 */
export function formatResponse(
  data: unknown,
  metadata?: {
    toolName?: string;
    correlationId?: string;
    executionTimeMs?: number;
    timestamp?: string;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const timestamp = metadata?.timestamp || new Date().toISOString();
  const response: Record<string, unknown> = {
    data,
    ...(metadata?.correlationId && { correlationId: metadata.correlationId }),
    ...(metadata?.executionTimeMs !== undefined && { executionTimeMs: metadata.executionTimeMs }),
    timestamp,
  };

  // Format response text with metadata
  let text = JSON.stringify(data, null, 2);
  
  // Add metadata as comments for LLM context
  if (metadata?.correlationId || metadata?.executionTimeMs !== undefined) {
    const metadataLines: string[] = [];
    if (metadata.correlationId) {
      metadataLines.push(`// Request ID: ${metadata.correlationId}`);
    }
    if (metadata.executionTimeMs !== undefined) {
      metadataLines.push(`// Execution time: ${metadata.executionTimeMs}ms`);
    }
    if (metadata.toolName) {
      metadataLines.push(`// Tool: ${metadata.toolName}`);
    }
    text = metadataLines.join("\n") + "\n" + text;
  }

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

/**
 * Formats balance response for better readability
 */
export function formatBalanceResponse(
  data: unknown,
  metadata?: {
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  // If data is a balance response, add a summary
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.balances || obj.currencies) {
      let summary = "## Balance Summary\n\n";
      
      if (Array.isArray(obj.balances)) {
        summary += "Available balances:\n";
        for (const balance of obj.balances) {
          if (balance && typeof balance === "object") {
            const bal = balance as Record<string, unknown>;
            const currency = bal.currency || bal.asset || "Unknown";
            const available = bal.available || bal.free || "0";
            const locked = bal.locked || "0";
            summary += `- ${currency}: ${available} available${locked !== "0" ? `, ${locked} locked` : ""}\n`;
          }
        }
      } else if (obj.currencies && typeof obj.currencies === "object") {
        summary += "Available balances:\n";
        for (const [currency, balance] of Object.entries(obj.currencies)) {
          if (balance && typeof balance === "object") {
            const bal = balance as Record<string, unknown>;
            const available = bal.available || bal.free || "0";
            const locked = bal.locked || "0";
            summary += `- ${currency}: ${available} available${locked !== "0" ? `, ${locked} locked` : ""}\n`;
          }
        }
      }
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

/**
 * Formats ticker response for better readability
 */
export function formatTickerResponse(
  data: unknown,
  metadata?: {
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  // If data is a ticker response, add a summary
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.lastPrice || obj.price) {
      let summary = "## Price Information\n\n";
      const symbol = obj.symbol || "Unknown";
      const price = obj.lastPrice || obj.price || "N/A";
      const change24h = obj.priceChange24h || obj.change24h;
      const changePercent24h = obj.priceChangePercent24h || obj.changePercent24h;
      
      summary += `**Symbol:** ${symbol}\n`;
      summary += `**Current Price:** ${price}\n`;
      if (change24h) {
        summary += `**24h Change:** ${change24h}`;
        if (changePercent24h) {
          summary += ` (${changePercent24h}%)`;
        }
        summary += "\n";
      }
      if (obj.volume24h) {
        summary += `**24h Volume:** ${obj.volume24h}\n`;
      }
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

/**
 * Formats order response for better readability
 */
export function formatOrderResponse(
  data: unknown,
  metadata?: {
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  // If data is an order response, add a summary
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.orderId || obj.clientOrderId || obj.symbol) {
      let summary = "## Order Status\n\n";
      
      if (obj.orderId) summary += `**Order ID:** ${obj.orderId}\n`;
      if (obj.clientOrderId) summary += `**Client Order ID:** ${obj.clientOrderId}\n`;
      if (obj.symbol) summary += `**Symbol:** ${obj.symbol}\n`;
      if (obj.side) summary += `**Side:** ${obj.side}\n`;
      if (obj.status) summary += `**Status:** ${obj.status}\n`;
      if (obj.executedPrice) summary += `**Executed Price:** ${obj.executedPrice}\n`;
      if (obj.executedQuantity) summary += `**Executed Quantity:** ${obj.executedQuantity}\n`;
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

/**
 * Formats order book response for better readability
 */
export function formatOrderBookResponse(
  data: unknown,
  metadata?: {
    toolName?: string;
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.bids || obj.asks || obj.symbol) {
      let summary = "## Order Book Summary\n\n";
      
      if (obj.symbol) summary += `**Symbol:** ${obj.symbol}\n`;
      
      if (Array.isArray(obj.bids) && obj.bids.length > 0) {
        const bestBid = obj.bids[0];
        if (bestBid && typeof bestBid === "object") {
          const bid = bestBid as Record<string, unknown>;
          summary += `**Best Bid:** ${bid[0] || bid.price || "N/A"} (Quantity: ${bid[1] || bid.quantity || "N/A"})\n`;
        }
        summary += `**Total Bids:** ${obj.bids.length} price levels\n`;
      }
      
      if (Array.isArray(obj.asks) && obj.asks.length > 0) {
        const bestAsk = obj.asks[0];
        if (bestAsk && typeof bestAsk === "object") {
          const ask = bestAsk as Record<string, unknown>;
          summary += `**Best Ask:** ${ask[0] || ask.price || "N/A"} (Quantity: ${ask[1] || ask.quantity || "N/A"})\n`;
        }
        summary += `**Total Asks:** ${obj.asks.length} price levels\n`;
      }
      
      if (obj.spread) {
        summary += `**Spread:** ${obj.spread}\n`;
      }
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

/**
 * Formats trades response for better readability
 */
export function formatTradesResponse(
  data: unknown,
  metadata?: {
    toolName?: string;
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.trades) || Array.isArray(obj.data)) {
      const trades = (obj.trades || obj.data) as unknown[];
      let summary = "## Recent Trades Summary\n\n";
      
      if (obj.symbol) summary += `**Symbol:** ${obj.symbol}\n`;
      summary += `**Total Trades:** ${trades.length}\n\n`;
      
      if (trades.length > 0) {
        summary += "**Recent Activity:**\n";
        const displayCount = Math.min(5, trades.length);
        for (let i = 0; i < displayCount; i++) {
          const trade = trades[i];
          if (trade && typeof trade === "object") {
            const t = trade as Record<string, unknown>;
            const price = t.price || t[0] || "N/A";
            const quantity = t.quantity || t.qty || t[1] || "N/A";
            const side = t.side || (t[2] === "buy" ? "BUY" : t[2] === "sell" ? "SELL" : "N/A");
            const time = t.time || t.timestamp || t[3] || "N/A";
            summary += `${i + 1}. ${side} ${quantity} @ ${price} (Time: ${time})\n`;
          }
        }
        if (trades.length > displayCount) {
          summary += `... and ${trades.length - displayCount} more trades\n`;
        }
      }
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

/**
 * Formats klines/candlestick response for better readability
 */
export function formatKlinesResponse(
  data: unknown,
  metadata?: {
    toolName?: string;
    correlationId?: string;
    executionTimeMs?: number;
  }
): {
  content: Array<{ type: "text"; text: string }>;
} {
  const response = formatResponse(data, metadata);
  
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.klines) || Array.isArray(obj.data) || Array.isArray(obj)) {
      const klines = (obj.klines || obj.data || obj) as unknown[];
      let summary = "## Candlestick Data Summary\n\n";
      
      if (obj.symbol) summary += `**Symbol:** ${obj.symbol}\n`;
      if (obj.interval) summary += `**Interval:** ${obj.interval}\n`;
      summary += `**Total Candles:** ${klines.length}\n\n`;
      
      if (klines.length > 0) {
        summary += "**Price Range:**\n";
        // Extract OHLC from first and last candles
        const firstCandle = klines[0];
        const lastCandle = klines[klines.length - 1];
        
        if (Array.isArray(firstCandle) && firstCandle.length >= 4) {
          summary += `- **Open (First):** ${firstCandle[0]}\n`;
          summary += `- **High (First):** ${firstCandle[1]}\n`;
          summary += `- **Low (First):** ${firstCandle[2]}\n`;
          summary += `- **Close (First):** ${firstCandle[3]}\n`;
        }
        
        if (Array.isArray(lastCandle) && lastCandle.length >= 4) {
          summary += `- **Close (Last):** ${lastCandle[3]}\n`;
        }
        
        // Calculate price change if possible
        if (Array.isArray(firstCandle) && Array.isArray(lastCandle) && 
            firstCandle.length >= 4 && lastCandle.length >= 4) {
          const openPrice = parseFloat(String(firstCandle[0]));
          const closePrice = parseFloat(String(lastCandle[3]));
          if (!isNaN(openPrice) && !isNaN(closePrice)) {
            const change = closePrice - openPrice;
            const changePercent = ((change / openPrice) * 100).toFixed(2);
            summary += `- **Price Change:** ${change >= 0 ? "+" : ""}${change} (${changePercent}%)\n`;
          }
        }
      }
      
      summary += "\n---\n\n";
      response.content[0].text = summary + response.content[0].text;
    }
  }
  
  return response;
}

