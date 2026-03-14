/*
  Minimal HTTP client with retries, timeout, structured errors, and redacted logs.
*/

import { setTimeout as delay } from "node:timers/promises";
import { redact } from "../config.js";
import { fetch } from "undici";
import { fileLogger } from "../utils/fileLogger.js";

export interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  retryCount: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;
  public readonly isHtmlResponse?: boolean;
  constructor(message: string, status: number, details?: unknown, isHtmlResponse?: boolean) {
    super(message);
    this.status = status;
    this.details = details;
    this.isHtmlResponse = isHtmlResponse;
  }
}

/**
 * Parses HTML error pages (like Cloudflare) to extract user-friendly error messages.
 * 
 * NOTE: This is transport-agnostic - it parses responses from Zebpay API (external),
 * not from MCP clients. Works identically for both stdio and HTTP transports.
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

export class HttpClient {
  constructor(private readonly logLevel: "debug" | "info" | "warn" | "error" = "info") {}

  async request<T = unknown>(opts: HttpRequestOptions): Promise<HttpResponse<T>> {
    const { method, url, headers = {}, body, timeoutMs, retryCount } = opts;
    const isIdempotent = method.toUpperCase() === "GET";
    const maxAttempts = isIdempotent ? retryCount + 1 : 1;

    const payload = body === undefined || body === null ? undefined : (typeof body === "string" ? body : JSON.stringify(body));
    
    // Prepare headers for request (with content-type)
    const requestHeaders: Record<string, string> = {
      ...headers,
    };
    if (payload) {
      requestHeaders["content-type"] = "application/json";
    }

    // Log HTTP request
    const requestTimestamp = new Date().toISOString();
    const requestLogMessage = JSON.stringify({
      level: "info",
      type: "http_request",
      timestamp: requestTimestamp,
      method: method.toUpperCase(),
      url,
      headers: this.sanitizeHeaders(requestHeaders),
      body: this.sanitizeBody(payload),
    });
    fileLogger.log(requestLogMessage);

    let attempt = 0;
    let lastError: unknown;
    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const attemptStartTime = Date.now();
      try {
        const res = await fetch(url, {
          method,
          headers: requestHeaders,
          body: payload,
          signal: controller.signal,
        } as any);
        clearTimeout(timer);

        const text = await res.text();
        const contentType = res.headers.get("content-type") || "";
        const isHtml = contentType.includes("text/html") || text.trim().toLowerCase().startsWith("<!doctype") || text.trim().toLowerCase().startsWith("<html");
        
        let data: any = undefined;
        let parsedError: string | null = null;
        
        if (isHtml && !res.ok) {
          // Try to parse HTML error page
          parsedError = parseHtmlError(text);
          data = text; // Keep original HTML for logging
        } else {
          // Try to parse as JSON
          try {
            data = text ? JSON.parse(text) : undefined;
          } catch {
            data = text;
          }
        }

        const response: HttpResponse<T> = {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          data,
        };

        const durationMs = Date.now() - attemptStartTime;
        
        // Log HTTP response with user-readable format
        const responseTimestamp = new Date().toISOString();
        const responseBody = this.formatResponseBody(data, res.status);
        
        const responseLogMessage = JSON.stringify({
          level: res.ok ? "info" : "warn",
          type: "http_response",
          timestamp: responseTimestamp,
          method: method.toUpperCase(),
          url,
          status: res.status,
          headers: this.sanitizeHeaders(response.headers),
          body: responseBody,
          durationMs,
          attempt,
          isHtmlResponse: isHtml,
        });
        fileLogger.log(responseLogMessage);

        if (res.ok) {
          return response;
        }

        // Retry on 429/5xx when idempotent
        if (isIdempotent && (res.status === 429 || (res.status >= 500 && res.status < 600)) && attempt < maxAttempts) {
          const retryAfter = Number(response.headers["retry-after"] || 0);
          const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 250 * attempt;
          await delay(backoffMs);
          continue;
        }

        // Use parsed error message if available, otherwise use default
        const errorMessage = parsedError || `HTTP ${res.status}`;
        throw new HttpError(errorMessage, res.status, data, isHtml);
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        const durationMs = Date.now() - attemptStartTime;
        
        // AbortError or network error
        if (attempt >= maxAttempts) {
          // Log HTTP error
          const errorTimestamp = new Date().toISOString();
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorStack = err instanceof Error ? err.stack : undefined;
          
          const errorLogMessage = JSON.stringify({
            level: "error",
            type: "http_error",
            timestamp: errorTimestamp,
            method: method.toUpperCase(),
            url,
            headers: this.sanitizeHeaders(requestHeaders),
            body: this.sanitizeBody(payload),
            durationMs,
            attempt,
            error: errorMessage,
            stack: this.sanitizeStack(errorStack),
          });
          fileLogger.log(errorLogMessage);
          
          if (err instanceof HttpError) throw err;
          throw new HttpError((err as Error).message || "Network error", 0);
        }
        await delay(200 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unknown HTTP error");
  }

  /**
   * Sanitizes stack traces by removing file paths, keeping only function names and line numbers
   */
  private sanitizeStack(stack: string | undefined): string | undefined {
    if (!stack) return undefined;
    
    try {
      // Remove file:// URLs and absolute paths, keep only filename and line numbers
      const lines = stack.split('\n');
      const sanitizedLines = lines.map(line => {
        let sanitized = line;
        
        // Remove file:// URLs (e.g., file:///Users/path/to/file.js:123:45)
        sanitized = sanitized.replace(/file:\/\/\/[^\s\)]+/g, (match) => {
          // Extract just the filename and line numbers
          const filenameMatch = match.match(/([^\/]+\.(js|ts|mjs|cjs)):(\d+):(\d+)/);
          if (filenameMatch) {
            return `${filenameMatch[1]}:${filenameMatch[3]}:${filenameMatch[4]}`;
          }
          return '';
        });
        
        // Remove absolute paths (e.g., /Users/path/to/file.js:123:45)
        sanitized = sanitized.replace(/\/(?:[^\/\s]+\/)+([^\/\s]+\.(js|ts|mjs|cjs)):(\d+):(\d+)/g, '$1:$3:$4');
        
        // Simplify node_modules paths (e.g., node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js)
        sanitized = sanitized.replace(/node_modules\/([^\/\s]+)\/[^\s\)]+/g, 'node_modules/$1');
        
        return sanitized.trim();
      });
      
      return sanitizedLines.join('\n');
    } catch {
      // If sanitization fails, return a minimal version without paths
      return stack.split('\n').slice(0, 3).join('\n'); // Keep only first 3 lines
    }
  }

  /**
   * Formats response body to be more user-readable
   */
  private formatResponseBody(body: unknown, status: number): unknown {
    if (body === undefined || body === null) {
      return body;
    }
    
    // For error responses, extract meaningful information
    if (status >= 400 && typeof body === "object" && body !== null) {
      const bodyObj = body as Record<string, unknown>;
      const formatted: Record<string, unknown> = {};
      
      // Extract common error fields
      if (typeof bodyObj.statusCode === "number") {
        formatted.statusCode = bodyObj.statusCode;
      }
      if (typeof bodyObj.statusDescription === "string") {
        formatted.statusDescription = bodyObj.statusDescription;
      }
      if (typeof bodyObj.error === "string") {
        formatted.error = bodyObj.error;
      }
      if (typeof bodyObj.message === "string") {
        formatted.message = bodyObj.message;
      }
      
      // Include data if present
      if (bodyObj.data !== undefined) {
        formatted.data = bodyObj.data;
      }
      
      // If we extracted meaningful fields, return formatted version
      if (Object.keys(formatted).length > 0) {
        return formatted;
      }
    }
    
    // For non-error responses or if formatting didn't extract anything, use sanitized body
    return this.sanitizeBody(body);
  }

  /**
   * Sanitizes headers to redact sensitive information
   */
  private sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveKeys = ["key", "sign", "secret", "password", "token", "authorization", "auth"];
    
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = redact(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitizes body to prevent logging huge payloads
   */
  private sanitizeBody(body: unknown): unknown {
    if (body === undefined || body === null) {
      return body;
    }
    
    // If body is a string, check size
    if (typeof body === "string") {
      if (body.length > 5000) {
        return body.substring(0, 5000) + "... [truncated]";
      }
      return body;
    }
    
    // If body is an object, stringify and check size
    try {
      const jsonStr = JSON.stringify(body);
      if (jsonStr.length > 5000) {
        return JSON.parse(jsonStr.substring(0, 5000) + '..."}');
      }
      return body;
    } catch {
      return body;
    }
  }
}
