/*
  Core ZebpayAPI encapsulates signing, sending, and error normalization.
*/

import { AppConfig } from "../config.js";
import { CredentialsProvider } from "../security/credentials.js";
import { buildAuthHeaders, buildQueryStringAuthHeaders, signQueryString, signPayloadString, signRequest } from "../security/signing.js";
import { HttpClient, HttpError } from "../http/httpClient.js";
import { convertHttpErrorToMcpError, createInternalError } from "../mcp/errors.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export interface RequestOptions {
  method: string;
  path: string; // path starting with '/'
  body?: unknown;
  useFutures?: boolean; // choose base URL
  queryParams?: Record<string, string>; // optional query parameters
}

export class ZebpayAPI {
  constructor(
    private readonly config: AppConfig,
    private readonly creds: CredentialsProvider,
    private readonly http: HttpClient
  ) {}

  private baseUrl(useFutures: boolean): string {
    return useFutures ? this.config.futuresBaseUrl : this.config.spotBaseUrl;
  }

  private buildUrl(useFutures: boolean, path: string, queryParams?: Record<string, string>): string {
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.baseUrl(useFutures)}${trimmed}`;
    
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
      url += `?${queryString}`;
      
      // Debug logging
      if (this.config.logLevel === "debug") {
        console.error(JSON.stringify({
          level: "debug",
          msg: "buildUrl details",
          queryParams,
          queryString,
          finalUrl: url
        }));
      }
    }
    
    return url;
  }

  async request<T = unknown>({ method, path, body, useFutures = false, queryParams: providedQueryParams }: RequestOptions): Promise<T> {
    const apiKey = this.creds.getApiKey();
    const secret = this.creds.getSecretKey();

    const methodUpper = method.toUpperCase();
    const isGetOrDelete = methodUpper === "GET" || methodUpper === "DELETE";
    const isPost = methodUpper === "POST";
    const includeBody = isPost && body !== undefined && body !== null;

    let url: string;
    let authHeaders: Record<string, string>;
    let finalBody: unknown = body;

    if (isGetOrDelete) {
      // For GET and DELETE requests, use query-string based signing (Zebpay API format)
      const timestamp = Date.now().toString();
      const queryParams: Record<string, string> = {
        timestamp,
        ...providedQueryParams, // Merge provided query params with timestamp
      };
      
      // Build query string for signing (sorted alphabetically for consistent signing)
      // This same sorted order must be used in the URL to match the signature
      const sortedEntries = Object.entries(queryParams)
        .sort(([a], [b]) => a.localeCompare(b));
      const queryString = sortedEntries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
      
      // Sign the query string
      const signature = signQueryString(queryString, secret);
      
      // Build auth headers (only API key and signature, no timestamp header)
      authHeaders = buildQueryStringAuthHeaders(apiKey, signature, this.config.signingHeaders);
      
      // Build URL with the same sorted query string to match the signature
      const trimmed = path.startsWith("/") ? path : `/${path}`;
      url = `${this.baseUrl(useFutures)}${trimmed}?${queryString}`;
      
      // Debug logging
      if (this.config.logLevel === "debug") {
        console.error(JSON.stringify({
          level: "debug",
          msg: `${methodUpper} request details`,
          path,
          queryString,
          timestamp,
          url,
          hasQueryParams: url.includes("?")
        }));
      }
    } else if (isPost) {
      // For POST requests, sign the JSON body directly (Zebpay API format)
      const timestamp = Date.now();
      
      // Prepare payload with timestamp added
      const payload = body ? { ...(body as Record<string, unknown>), timestamp } : { timestamp };
      
      // Stringify the payload (deterministic JSON stringify)
      const payloadString = JSON.stringify(payload);
      
      // Sign the payload string directly
      const signature = signPayloadString(payloadString, secret);
      
      // Build auth headers (only API key and signature, no timestamp header)
      authHeaders = buildQueryStringAuthHeaders(apiKey, signature, this.config.signingHeaders);
      
      // Set the final body with timestamp included
      finalBody = payload;
      url = this.buildUrl(useFutures, path);
      
      // Debug logging
      if (this.config.logLevel === "debug") {
        console.error(JSON.stringify({
          level: "debug",
          msg: "POST request details",
          path,
          payloadString,
          timestamp,
          signature
        }));
      }
    } else {
      // For other methods (PUT, PATCH, etc.), fall back to original signing method
      const signature = signRequest(method, path, includeBody ? body : undefined, secret, {
        headers: this.config.signingHeaders,
        includeBody,
      });
      authHeaders = buildAuthHeaders(apiKey, signature, this.config.signingHeaders);
      url = this.buildUrl(useFutures, path);
    }

    try {
      const res = await this.http.request<T>({
        method,
        url,
        headers: authHeaders,
        body: isPost ? finalBody : (isGetOrDelete ? undefined : body),
        timeoutMs: this.config.timeoutMs,
        retryCount: this.config.retryCount,
      });
      return res.data as T;
    } catch (err) {
      if (err instanceof HttpError) {
        // Extract error message from various possible response formats
        let errorMessage = err.message || "Unknown API error";
        
        // Extract error message and preserve full details for better error handling
        let errorDetails = err.details;
        
        if (err.details) {
          if (typeof err.details === "string") {
            errorMessage = err.details;
          } else if (typeof err.details === "object") {
            // Check common error response fields (in order of preference)
            const details = err.details as Record<string, unknown>;
            
            // Extract statusDescription first (most specific)
            if (typeof details.statusDescription === "string" && details.statusDescription) {
              errorMessage = details.statusDescription;
            } else if (typeof details.error === "string" && details.error) {
              errorMessage = details.error;
            } else if (typeof details.message === "string" && details.message) {
              errorMessage = details.message;
            } else if (typeof details.msg === "string" && details.msg) {
              errorMessage = details.msg;
            } else if (typeof details.errorMessage === "string" && details.errorMessage) {
              errorMessage = details.errorMessage;
            }
            
            // Preserve the full details object for error conversion
            errorDetails = details;
          }
        }
        
        throw convertHttpErrorToMcpError(err.status, errorMessage, errorDetails, err.isHtmlResponse);
      }
      // Re-throw MCP errors as-is
      if (err instanceof McpError) {
        throw err;
      }
      // Wrap other errors as internal errors
      throw createInternalError(
        err instanceof Error ? err.message : String(err),
        { originalError: String(err) }
      );
    }
  }
}

