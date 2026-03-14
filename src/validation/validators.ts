/*
  Input validation helpers with helpful error messages for LLMs.
*/

import { z } from "zod";
import { createInvalidParamsError } from "../mcp/errors.js";

/**
 * Validates trading pair symbol format (BASE-QUOTE)
 * Examples: BTC-INR, ETH-INR, BTC-USDT
 */
export function validateSymbol(symbol: string): void {
  if (!symbol || typeof symbol !== "string") {
    throw createInvalidParamsError(
      `Invalid symbol: must be a non-empty string. Expected format: BASE-QUOTE (e.g., "BTC-INR", "ETH-INR")`
    );
  }
  
  const trimmed = symbol.trim().toUpperCase();
  const parts = trimmed.split("-");
  
  if (parts.length !== 2) {
    throw createInvalidParamsError(
      `Invalid symbol format: "${symbol}". Expected format: BASE-QUOTE (e.g., "BTC-INR", "ETH-INR", "BTC-USDT"). Use uppercase currency codes separated by a single hyphen.`
    );
  }
  
  const [base, quote] = parts;
  
  if (!base || base.length === 0) {
    throw createInvalidParamsError(
      `Invalid symbol: base currency is missing. Expected format: BASE-QUOTE (e.g., "BTC-INR")`
    );
  }
  
  if (!quote || quote.length === 0) {
    throw createInvalidParamsError(
      `Invalid symbol: quote currency is missing. Expected format: BASE-QUOTE (e.g., "BTC-INR")`
    );
  }
  
  // Check for valid currency code format (alphanumeric, typically 2-10 characters)
  const currencyCodeRegex = /^[A-Z0-9]{2,10}$/;
  if (!currencyCodeRegex.test(base)) {
    throw createInvalidParamsError(
      `Invalid base currency code: "${base}". Currency codes should be 2-10 uppercase alphanumeric characters (e.g., "BTC", "ETH", "USDT")`
    );
  }
  if (!currencyCodeRegex.test(quote)) {
    throw createInvalidParamsError(
      `Invalid quote currency code: "${quote}". Currency codes should be 2-10 uppercase alphanumeric characters (e.g., "INR", "USDT", "BTC")`
    );
  }
}

/**
 * Validates quantity string format
 */
export function validateQuantity(quantity: string): void {
  if (!quantity || typeof quantity !== "string") {
    throw createInvalidParamsError(
      `Invalid quantity: must be a non-empty string. This prevents floating-point precision issues. Example: "0.001" or "100"`
    );
  }
  
  const trimmed = quantity.trim();
  if (trimmed.length === 0) {
    throw createInvalidParamsError(
      `Invalid quantity: cannot be empty. Provide a positive number as a string (e.g., "0.001", "100", "0.5")`
    );
  }
  
  // Check if it's a valid number format
  const numberRegex = /^-?\d+(\.\d+)?$/;
  if (!numberRegex.test(trimmed)) {
    throw createInvalidParamsError(
      `Invalid quantity format: "${quantity}". Expected a positive number as a string. Examples: "0.001", "100", "0.5". Do not include commas or other formatting.`
    );
  }
  
  // Check if it's positive
  const numValue = parseFloat(trimmed);
  if (isNaN(numValue)) {
    throw createInvalidParamsError(
      `Invalid quantity: "${quantity}" is not a valid number. Provide a positive number as a string (e.g., "0.001")`
    );
  }
  
  if (numValue <= 0) {
    throw createInvalidParamsError(
      `Invalid quantity: "${quantity}" must be greater than zero. Provide a positive number as a string (e.g., "0.001", "100")`
    );
  }
  
  // Check for reasonable precision (typically up to 8 decimal places for crypto)
  const decimalParts = trimmed.split(".");
  if (decimalParts.length === 2 && decimalParts[1].length > 18) {
    throw createInvalidParamsError(
      `Invalid quantity precision: "${quantity}" has too many decimal places (max 18). Example: "0.001" or "100.123456789012345678"`
    );
  }
}

/**
 * Zod schema for symbol validation
 */
export const symbolSchema = z.string().min(1).refine(
  (val) => {
    try {
      validateSymbol(val);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid symbol format. Expected BASE-QUOTE (e.g., "BTC-INR", "ETH-INR")',
  }
);

/**
 * Zod schema for quantity validation
 */
export const quantitySchema = z.string().min(1).refine(
  (val) => {
    try {
      validateQuantity(val);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid quantity format. Expected a positive number as a string (e.g., "0.001", "100")',
  }
);

/**
 * Validates clientOrderId format
 * Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens
 * Length must be between 1-36 characters
 */
export function validateClientOrderId(clientOrderId: string): void {
  if (!clientOrderId || typeof clientOrderId !== "string") {
    throw createInvalidParamsError(
      `Invalid clientOrderId: must be a non-empty string`
    );
  }
  
  const trimmed = clientOrderId.trim();
  
  if (trimmed.length === 0) {
    throw createInvalidParamsError(
      `Invalid clientOrderId: cannot be empty`
    );
  }
  
  if (trimmed.length > 36) {
    throw createInvalidParamsError(
      `Invalid clientOrderId: "${clientOrderId}" exceeds maximum length of 36 characters (current: ${trimmed.length})`
    );
  }
  
  // Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens
  const validFormat = /^[a-zA-Z0-9.:/_\-]+$/;
  if (!validFormat.test(trimmed)) {
    throw createInvalidParamsError(
      `Invalid clientOrderId format: "${clientOrderId}". Must contain only letters, numbers, dots, colons, slashes, underscores, and hyphens. Examples: "my-order-123", "order:2024/01/15_001", "trade.abc-123"`
    );
  }
}

/**
 * Zod schema for clientOrderId validation
 */
export const clientOrderIdSchema = z.string().min(1).max(36).refine(
  (val) => {
    try {
      validateClientOrderId(val);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid clientOrderId format. Must be 1-36 characters and contain only letters, numbers, dots, colons, slashes, underscores, and hyphens',
  }
);

