/*
  MCP request/response logging utility for tracing and debugging.
*/

import { fileLogger } from "../utils/fileLogger.js";
import { generateCorrelationId } from "../utils/responseFormatter.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export interface LogContext {
  toolName: string;
  logLevel: "debug" | "info" | "warn" | "error";
  correlationId?: string;
}

/**
 * Logs MCP tool request with parameters
 */
export function logMcpRequest(context: LogContext, params: unknown): void {
  try {
  const { toolName, logLevel, correlationId } = context;
  const timestamp = new Date().toISOString();
  
  const logMessage = JSON.stringify({
    level: "info",
    type: "mcp_request",
    timestamp,
    tool: toolName,
    correlationId: correlationId || generateCorrelationId(),
    params: sanitizeParams(params),
  });
  
  fileLogger.log(logMessage);
  } catch (error) {
    // Silently fail logging to prevent breaking the application
    console.error(`[LOG ERROR] Failed to log MCP request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Logs MCP tool response (success)
 */
export function logMcpResponse(
  context: LogContext,
  params: unknown,
  result: unknown,
  durationMs: number
): void {
  try {
  const { toolName, logLevel, correlationId } = context;
  const timestamp = new Date().toISOString();
  
  const logMessage = JSON.stringify({
    level: "info",
    type: "mcp_response",
    timestamp,
    tool: toolName,
    correlationId: correlationId || generateCorrelationId(),
    params: sanitizeParams(params),
    success: true,
    durationMs,
    result: sanitizeResult(result),
  });
  
  fileLogger.log(logMessage);
  } catch (error) {
    // Silently fail logging to prevent breaking the application
    console.error(`[LOG ERROR] Failed to log MCP response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sanitizes stack traces by removing file paths, keeping only function names and line numbers
 */
function sanitizeStack(stack: string | undefined): string | undefined {
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
 * Logs MCP tool error response
 */
export function logMcpError(
  context: LogContext,
  params: unknown,
  error: unknown,
  durationMs: number
): void {
  try {
  const { toolName, logLevel, correlationId } = context;
  const timestamp = new Date().toISOString();
  
  // Extract error details
  let errorMessage = error instanceof Error ? error.message : String(error);
  let errorStack = error instanceof Error ? error.stack : undefined;
  let errorCode: number | undefined;
  let errorData: unknown;
  
  // If it's an MCP error, extract additional details
  if (error instanceof McpError) {
    errorCode = error.code;
    errorData = error.data;
    // MCP errors have a formatted message, use it directly
    errorMessage = error.message;
  } else if (error && typeof error === "object" && "code" in error) {
    // Check if it's an MCP error-like object (from SDK)
    errorCode = typeof error.code === "number" ? error.code : undefined;
    if ("data" in error) {
      errorData = error.data;
    }
  }
  
  const logMessage = JSON.stringify({
    level: "error",
    type: "mcp_error",
    timestamp,
    tool: toolName,
    correlationId: correlationId || generateCorrelationId(),
    params: sanitizeParams(params),
    success: false,
    durationMs,
    error: errorMessage,
    ...(errorCode !== undefined && { errorCode }),
    ...(errorData !== undefined && { errorData: sanitizeParams(errorData) }),
    ...(errorStack && { stack: sanitizeStack(errorStack) }),
  });
  
  fileLogger.log(logMessage);
  } catch (logError) {
    // Silently fail logging to prevent breaking the application
    console.error(`[LOG ERROR] Failed to log MCP error: ${logError instanceof Error ? logError.message : String(logError)}`);
  }
}

/**
 * Wraps an MCP tool handler with request/response logging
 */
export function withLogging<TParams, TResult>(
  toolName: string,
  logLevel: "debug" | "info" | "warn" | "error",
  handler: (params: TParams) => Promise<TResult>
): (params: TParams) => Promise<TResult> {
  return async (params: TParams): Promise<TResult> => {
    const correlationId = generateCorrelationId();
    const context: LogContext = { toolName, logLevel, correlationId };
    const startTime = Date.now();
    
    // Log request
    logMcpRequest(context, params);
    
    try {
      // Execute handler
      const result = await handler(params);
      const durationMs = Date.now() - startTime;
      
      // Log successful response
      logMcpResponse(context, params, result, durationMs);
      
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Log error response
      logMcpError(context, params, error, durationMs);
      
      // Re-throw error
      throw error;
    }
  };
}

/**
 * Sanitizes parameters to remove sensitive data
 */
function sanitizeParams(params: unknown): unknown {
  try {
  if (!params || typeof params !== "object") {
    return params;
  }
  
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ["apiKey", "secret", "password", "token", "authorization"];
  
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = "<redacted>";
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
  } catch (error) {
    // If sanitization fails, return a safe fallback
    return { error: "Failed to sanitize params", original: String(params) };
  }
}

/**
 * Sanitizes result to prevent logging huge responses
 */
function sanitizeResult(result: unknown): unknown {
  try {
  if (!result) {
    return result;
  }
  
  // If result is a string, check if it's JSON and limit size
  if (typeof result === "string") {
    if (result.length > 10000) {
      return result.substring(0, 10000) + "... [truncated]";
    }
    return result;
  }
  
  // If result is an object with content array (MCP response format)
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.content)) {
      const sanitizedContent = obj.content.map((item: unknown) => {
        if (typeof item === "object" && item !== null) {
          const itemObj = item as Record<string, unknown>;
          if (typeof itemObj.text === "string" && itemObj.text.length > 10000) {
            return {
              ...itemObj,
              text: itemObj.text.substring(0, 10000) + "... [truncated]",
            };
          }
        }
        return item;
      });
      return {
        ...obj,
        content: sanitizedContent,
      };
    }
  }
  
  // For other objects, stringify and limit size
  try {
    const jsonStr = JSON.stringify(result);
    if (jsonStr.length > 10000) {
      return JSON.parse(jsonStr.substring(0, 10000) + '..."}');
    }
    return result;
  } catch {
    return result;
    }
  } catch (error) {
    // If sanitization fails, return a safe fallback
    return { error: "Failed to sanitize result", type: typeof result };
  }
}

