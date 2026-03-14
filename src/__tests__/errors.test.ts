/*
  Error handling tests for MCP error utilities.
*/

import { createInvalidParamsError, createInternalError, convertHttpErrorToMcpError } from "../mcp/errors.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Basic test suite (requires jest to be installed)
describe("MCP Error Handling", () => {
  describe("createInvalidParamsError", () => {
    it("should create an InvalidParams error with message", () => {
      const error = createInvalidParamsError("Invalid symbol format");
      
      if (!(error instanceof Error)) {
        throw new Error("Expected error to be instance of Error");
      }
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected error code ${ErrorCode.InvalidParams}, got ${error.code}`);
      }
      // MCP error messages include code prefix: "MCP error -32602: <message>"
      if (!error.message.includes("Invalid symbol format")) {
        throw new Error(`Expected error message to contain "Invalid symbol format", got "${error.message}"`);
      }
    });

    it("should include data when provided", () => {
      const data = { symbol: "BTC-INR" };
      const error = createInvalidParamsError("Invalid symbol", data);
      
      if (JSON.stringify(error.data) !== JSON.stringify(data)) {
        throw new Error(`Expected error data to match ${JSON.stringify(data)}`);
      }
    });
  });

  describe("createInternalError", () => {
    it("should create an InternalError with message", () => {
      const error = createInternalError("Server error occurred");
      
      if (!(error instanceof Error)) {
        throw new Error("Expected error to be instance of Error");
      }
      if (error.code !== ErrorCode.InternalError) {
        throw new Error(`Expected error code ${ErrorCode.InternalError}, got ${error.code}`);
      }
      // MCP error messages include code prefix: "MCP error -32603: <message>"
      if (!error.message.includes("Server error occurred")) {
        throw new Error(`Expected error message to contain "Server error occurred", got "${error.message}"`);
      }
    });

    it("should include data when provided", () => {
      const data = { status: 500 };
      const error = createInternalError("Server error", data);
      
      if (JSON.stringify(error.data) !== JSON.stringify(data)) {
        throw new Error(`Expected error data to match ${JSON.stringify(data)}`);
      }
    });
  });

  describe("convertHttpErrorToMcpError", () => {
    it("should convert 400 to InvalidParams", () => {
      const error = convertHttpErrorToMcpError(400, "Bad request", {});
      
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected InvalidParams, got ${error.code}`);
      }
      // The message should contain the original message or a transformed version
      if (!error.message.toLowerCase().includes("bad request") && !error.message.toLowerCase().includes("invalid")) {
        throw new Error(`Expected message to contain "bad request" or "invalid", got "${error.message}"`);
      }
    });

    it("should convert 401 to InvalidParams with auth message", () => {
      const error = convertHttpErrorToMcpError(401, "Unauthorized", {});
      
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected InvalidParams, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("credential")) {
        throw new Error(`Expected message to contain "credential", got "${error.message}"`);
      }
    });

    it("should convert 403 to InvalidParams with auth message", () => {
      const error = convertHttpErrorToMcpError(403, "Forbidden", {});
      
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected InvalidParams, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("credential")) {
        throw new Error(`Expected message to contain "credential", got "${error.message}"`);
      }
    });

    it("should convert 404 to InvalidParams", () => {
      const error = convertHttpErrorToMcpError(404, "Not found", {});
      
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected InvalidParams, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("not found")) {
        throw new Error(`Expected message to contain "not found", got "${error.message}"`);
      }
    });

    it("should convert 429 to InternalError with retryable flag", () => {
      const error = convertHttpErrorToMcpError(429, "Rate limit", {});
      
      if (error.code !== ErrorCode.InternalError) {
        throw new Error(`Expected InternalError, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("rate limit")) {
        throw new Error(`Expected message to contain "rate limit", got "${error.message}"`);
      }
      const data = error.data as { retryable?: boolean };
      if (!data?.retryable) {
        throw new Error("Expected retryable flag to be true");
      }
    });

    it("should convert 500 to InternalError with retryable flag", () => {
      const error = convertHttpErrorToMcpError(500, "Server error", {});
      
      if (error.code !== ErrorCode.InternalError) {
        throw new Error(`Expected InternalError, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("server error")) {
        throw new Error(`Expected message to contain "server error", got "${error.message}"`);
      }
      const data = error.data as { retryable?: boolean };
      if (!data?.retryable) {
        throw new Error("Expected retryable flag to be true");
      }
    });

    it("should convert network error (status 0) to InternalError", () => {
      const error = convertHttpErrorToMcpError(0, "Network error", {});
      
      if (error.code !== ErrorCode.InternalError) {
        throw new Error(`Expected InternalError, got ${error.code}`);
      }
      if (!error.message.toLowerCase().includes("network")) {
        throw new Error(`Expected message to contain "network", got "${error.message}"`);
      }
      const data = error.data as { retryable?: boolean };
      if (!data?.retryable) {
        throw new Error("Expected retryable flag to be true");
      }
    });

    it("should handle generic HTTP error messages", () => {
      const error = convertHttpErrorToMcpError(400, "HTTP 400", {});
      
      if (error.code !== ErrorCode.InvalidParams) {
        throw new Error(`Expected InvalidParams, got ${error.code}`);
      }
      if (error.message === "HTTP 400") {
        throw new Error("Expected message to be transformed, not generic HTTP 400");
      }
    });

    it("should preserve detailed error messages", () => {
      const detailedMessage = "Symbol BTC-INR not found in exchange";
      const error = convertHttpErrorToMcpError(404, detailedMessage, {});
      
      if (!error.message.includes(detailedMessage)) {
        throw new Error(`Expected message to contain "${detailedMessage}", got "${error.message}"`);
      }
    });
  });
});

// Helper functions for tests (if jest is not available, these provide basic functionality)
declare global {
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void): void;
}

