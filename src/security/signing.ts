/*
  HMAC signing utilities for ZebPay.
  The exact prehash format and header names are configurable via config to match ZebPay docs.
*/

import crypto from "node:crypto";
import { SigningHeaderNames } from "../config.js";

export interface SignatureResult {
  signature: string;
  timestamp: string;
}

export interface SigningOptions {
  headers: SigningHeaderNames;
  /** If true, include body in prehash; set false for GETs without body. */
  includeBody?: boolean;
  /** Allows overriding timestamp for testing. */
  now?: () => number;
}

export function stableStringify(value: unknown): string {
  // Deterministic JSON stringify for signing.
  return JSON.stringify(value, Object.keys(value as object).sort());
}

/**
 * Sign a query string using HMAC-SHA256 (Zebpay API format).
 * This matches the Postman script format where query parameters are signed directly.
 */
export function signQueryString(
  queryString: string,
  secretKey: string
): string {
  return crypto.createHmac("sha256", secretKey).update(queryString).digest("hex");
}

/**
 * Sign a JSON payload string using HMAC-SHA256 (Zebpay API format for POST requests).
 * This matches the Postman script format where the JSON body string is signed directly.
 */
export function signPayloadString(
  payloadString: string,
  secretKey: string
): string {
  return crypto.createHmac("sha256", secretKey).update(payloadString).digest("hex");
}

/**
 * Produce an HMAC-SHA256 signature. Default prehash: `${method}\n${path}\n${timestamp}\n${body}`.
 */
export function signRequest(
  method: string,
  path: string,
  body: unknown,
  secretKey: string,
  opts: SigningOptions
): SignatureResult {
  const timestamp = String((opts.now ? opts.now() : Date.now()));
  const useBody = opts.includeBody ?? (method.toUpperCase() !== "GET" && body !== undefined && body !== null);
  const bodyString = useBody ? (typeof body === "string" ? body : stableStringify(body)) : "";
  const prehash = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyString}`;
  const signature = crypto.createHmac("sha256", secretKey).update(prehash).digest("hex");
  return { signature, timestamp };
}

export function buildAuthHeaders(
  apiKey: string,
  sig: SignatureResult,
  headerNames: SigningHeaderNames
): Record<string, string> {
  const headers: Record<string, string> = {
    [headerNames.apiKeyHeader]: apiKey,
    [headerNames.signatureHeader]: sig.signature,
  };
  // Only include timestamp header if it's configured (for non-query-string signing)
  if (headerNames.timestampHeader) {
    headers[headerNames.timestampHeader] = sig.timestamp;
  }
  return headers;
}

/**
 * Build auth headers for query-string based signing (Zebpay format).
 * Only includes API key and signature headers, no timestamp header.
 */
export function buildQueryStringAuthHeaders(
  apiKey: string,
  signature: string,
  headerNames: SigningHeaderNames
): Record<string, string> {
  return {
    [headerNames.apiKeyHeader]: apiKey,
    [headerNames.signatureHeader]: signature,
  };
}


