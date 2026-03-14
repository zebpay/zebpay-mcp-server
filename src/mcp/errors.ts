/*
  MCP error handling utilities using MCP SDK error types.
*/

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates an MCP error for invalid parameters with helpful messages
 */
export function createInvalidParamsError(message: string, data?: unknown): McpError {
  return new McpError(ErrorCode.InvalidParams, message, data);
}

/**
 * Creates an MCP error for internal/server errors
 */
export function createInternalError(message: string, data?: unknown): McpError {
  return new McpError(ErrorCode.InternalError, message, data);
}

/**
 * Converts HTTP errors to appropriate MCP errors.
 * 
 * NOTE: This is transport-agnostic - converts errors from Zebpay API (external)
 * to MCP-compliant errors. Works identically for both stdio and HTTP transports.
 * 
 * @param status HTTP status code from Zebpay API
 * @param message Error message (may be HTML if from Cloudflare)
 * @param details Additional error details
 * @param isHtmlResponse Whether the response was HTML (for Cloudflare errors)
 */
export function convertHttpErrorToMcpError(
  status: number,
  message: string,
  details?: unknown,
  isHtmlResponse?: boolean
): McpError {
  // If message is HTML or contains HTML tags, try to extract meaningful error
  if (isHtmlResponse || (typeof message === "string" && (message.includes("<!doctype") || message.includes("<html")))) {
    // Try to parse HTML error
    const htmlText = typeof message === "string" ? message : String(details || "");
    const parsedMessage = parseHtmlError(htmlText);
    
    if (parsedMessage) {
      message = parsedMessage;
    } else {
      // Fallback for HTML errors
      if (htmlText.includes("Access denied") || htmlText.includes("banned")) {
        message = "Access denied: Your IP address has been restricted. Please contact support or try again later.";
      } else if (htmlText.includes("Cloudflare")) {
        message = "Cloudflare error: Access to the API has been restricted. Please try again later or contact support.";
      } else {
        message = "API access error: The server returned an HTML error page. Please check your API credentials and try again.";
      }
    }
  }

  // 4xx errors are typically invalid parameters or requests
  if (status >= 400 && status < 500) {
    // 401/403 are authentication errors - treat as invalid params
    if (status === 401 || status === 403) {
      const userMessage = message && message !== `HTTP ${status}` && !message.startsWith("HTTP")
        ? `${message}. Please check your API credentials.`
        : "Authentication failed. Please check your API credentials and try again.";
      
      return createInvalidParamsError(
        userMessage,
        { status, details }
      );
    }
    // 400 is bad request - invalid params
    if (status === 400) {
      // Extract additional error details from response
      let enhancedMessage = message;
      let statusCode: number | undefined;
      let statusDescription: string | undefined;
      
      if (details && typeof details === "object") {
        const detailsObj = details as Record<string, unknown>;
        statusCode = typeof detailsObj.statusCode === "number" ? detailsObj.statusCode : undefined;
        statusDescription = typeof detailsObj.statusDescription === "string" 
          ? detailsObj.statusDescription 
          : undefined;
        
        // Handle specific API error codes
        if (statusCode === 77 && statusDescription) {
          // Market order minimum value error
          // Extract minimum value from the error message if present
          const minValueMatch = statusDescription.match(/minimum\s+([\d,]+\.?\d*)\s+(\w+)/i);
          if (minValueMatch) {
            const minValue = minValueMatch[1];
            const currency = minValueMatch[2];
            enhancedMessage = `${statusDescription} Please ensure your order value meets the minimum requirement of ${minValue} ${currency}.`;
          } else {
            enhancedMessage = statusDescription;
          }
        } else if (statusCode && statusDescription) {
          // Use the status description with code for context
          enhancedMessage = `[Error ${statusCode}] ${statusDescription}`;
        } else if (statusDescription) {
          // Use the status description if available
          enhancedMessage = statusDescription;
        }
      }
      
      // If message already contains useful information, use it directly
      // Otherwise, provide a generic message
      const userMessage = enhancedMessage && enhancedMessage !== "HTTP 400" && !enhancedMessage.startsWith("HTTP")
        ? enhancedMessage
        : message && message !== "HTTP 400" && !message.startsWith("HTTP")
        ? message
        : "The request was invalid. Please check your parameters and try again.";
      
      return createInvalidParamsError(
        userMessage,
        { status, statusCode, statusDescription, details }
      );
    }
    // 404 is not found - could be invalid symbol or resource
    if (status === 404) {
      const userMessage = message && message !== "HTTP 404" && !message.startsWith("HTTP")
        ? `${message}. Please check the symbol or resource identifier.`
        : "Resource not found. Please check the symbol or resource identifier and try again.";
      
      return createInvalidParamsError(
        userMessage,
        { status, details }
      );
    }
    // 429 is rate limit - treat as internal error with retry guidance
    if (status === 429) {
      const userMessage = message && message !== "HTTP 429" && !message.startsWith("HTTP")
        ? `Rate limit exceeded: ${message}. Please retry after a short delay.`
        : "Rate limit exceeded. Please wait a moment and try again.";
      
      return createInternalError(
        userMessage,
        { status, details, retryable: true }
      );
    }
    // Other 4xx errors
    const userMessage = message && message !== `HTTP ${status}` && !message.startsWith("HTTP")
      ? message
      : `Request error (${status}). Please check your parameters and try again.`;
    
    return createInvalidParamsError(
      userMessage,
      { status, details }
    );
  }
  
  // 5xx errors are server/internal errors
  if (status >= 500) {
    const userMessage = message && message !== `HTTP ${status}` && !message.startsWith("HTTP")
      ? `Zebpay API server error: ${message}. Please try again later.`
      : `Zebpay API server error (${status}). The server encountered an issue. Please try again later.`;
    
    return createInternalError(
      userMessage,
      { status, details, retryable: true }
    );
  }
  
  // Network errors (status 0) or other errors
  const userMessage = message && message !== "Network error" && message !== "Unknown API error"
    ? `Network error: ${message}. Please check your connection and try again.`
    : "Network error. Please check your internet connection and try again.";
  
  return createInternalError(
    userMessage,
    { status, details, retryable: true }
  );
}

/**
 * Parses HTML error pages (like Cloudflare) to extract user-friendly error messages.
 * 
 * NOTE: Transport-agnostic - parses HTML responses from Zebpay API (external),
 * not from MCP clients. Works for both stdio and HTTP transports.
 */
function parseHtmlError(html: string): string | null {
  if (!html || typeof html !== "string") {
    return null;
  }

  // Check if it's HTML
  if (!html.trim().toLowerCase().startsWith("<!doctype") && !html.trim().toLowerCase().startsWith("<html")) {
    return null;
  }

  // Extract Cloudflare error messages
  const cloudflarePatterns = [
    // Cloudflare Error 1006 - Access denied
    /<h2[^>]*>Access denied<\/h2>/i,
    /The owner of this website.*?has banned your IP address[^<]*/i,
    /<p[^>]*>The owner of this website[^<]*<\/p>/i,
    // Cloudflare Error 1020 - Access denied
    /<h1[^>]*>Error[^<]*<\/h1>/i,
    // Generic error extraction from title
    /<title>([^<]+)<\/title>/i,
    // Extract error messages from h1/h2 tags
    /<h[12][^>]*>([^<]+)<\/h[12]>/i,
  ];

  for (const pattern of cloudflarePatterns) {
    const match = html.match(pattern);
    if (match) {
      let message = match[1] || match[0];
      // Clean up HTML entities and tags
      message = message
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();

      if (message && message.length > 10) {
        // Check for IP ban message
        if (html.includes("banned your IP address")) {
          const ipMatch = html.match(/IP address[^<]*\(([^)]+)\)/i);
          if (ipMatch) {
            return `Access denied: Your IP address has been banned by the website. Please contact support or try again later.`;
          }
          return `Access denied: Your IP address has been restricted. Please contact support or try again later.`;
        }

        // Check for Cloudflare error codes
        const errorCodeMatch = html.match(/Error\s*(\d+)/i);
        if (errorCodeMatch) {
          const errorCode = errorCodeMatch[1];
          if (errorCode === "1006") {
            return `Access denied (Error 1006): Your IP address has been banned. Please contact support or try again later.`;
          }
          return `Cloudflare error (${errorCode}): ${message}`;
        }

        return message;
      }
    }
  }

  // Fallback: try to extract any meaningful text
  const textMatch = html.match(/<body[^>]*>([\s\S]{100,500})<\/body>/i);
  if (textMatch) {
    let text = textMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 20 && text.length < 200) {
      return text;
    }
  }

  return null;
}

