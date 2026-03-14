/*
  Basic test setup for ZebPay MCP Server
  Note: Install jest dependencies first: npm install --save-dev jest @types/jest ts-jest
  Then run: npm test
*/

import { validateSymbol, validateQuantity } from "../validation/validators.js";
import { createInvalidParamsError } from "../mcp/errors.js";

// Basic test suite (requires jest to be installed)
describe("Validation", () => {
  describe("validateSymbol", () => {
    it("should accept valid symbols", () => {
      expect(() => validateSymbol("BTC-INR")).not.toThrow();
      expect(() => validateSymbol("ETH-INR")).not.toThrow();
      expect(() => validateSymbol("BTC-USDT")).not.toThrow();
    });

    it("should reject invalid symbols", () => {
      expect(() => validateSymbol("BTCINR")).toThrow();
      expect(() => validateSymbol("BTC/INR")).toThrow();
      // Note: "btc-inr" is converted to uppercase and becomes valid "BTC-INR"
      // So we test with a symbol that's invalid even after conversion
      expect(() => validateSymbol("")).toThrow();
      expect(() => validateSymbol("BTC-INR-EXTRA")).toThrow(); // Too many parts
    });

    it("should accept lowercase symbols (converts to uppercase)", () => {
      // The function converts to uppercase, so lowercase should work
      expect(() => validateSymbol("btc-inr")).not.toThrow();
      expect(() => validateSymbol("eth-inr")).not.toThrow();
    });
  });

  describe("validateQuantity", () => {
    it("should accept valid quantities", () => {
      expect(() => validateQuantity("0.001")).not.toThrow();
      expect(() => validateQuantity("100")).not.toThrow();
      expect(() => validateQuantity("0.5")).not.toThrow();
    });

    it("should reject invalid quantities", () => {
      expect(() => validateQuantity("")).toThrow();
      expect(() => validateQuantity("0")).toThrow();
      expect(() => validateQuantity("-1")).toThrow();
      expect(() => validateQuantity("abc")).toThrow();
    });
  });
});

describe("Error Handling", () => {
  it("should create invalid params error with correct code", () => {
    const error = createInvalidParamsError("Test error");
    // Note: These assertions require jest to be installed
    // expect(error).toBeInstanceOf(Error);
    // expect(error.code).toBe(-32602);
    // expect(error.message).toBe("Test error");
    
    // Basic validation without jest
    if (!(error instanceof Error)) {
      throw new Error("Expected error to be instance of Error");
    }
    if (error.code !== -32602) {
      throw new Error(`Expected error code -32602, got ${error.code}`);
    }
    // MCP error messages include code prefix: "MCP error -32602: <message>"
    if (!error.message.includes("Test error")) {
      throw new Error(`Expected error message to contain "Test error", got "${error.message}"`);
    }
  });
});

// Helper functions for tests (if jest is not available, these provide basic functionality)
declare global {
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void): void;
  function expect(fn: () => void): {
    not: { toThrow: () => void };
    toThrow: () => void;
  };
  function expect<T>(value: T): {
    toBeInstanceOf: (constructor: new (...args: any[]) => T) => void;
    toBe: (expected: T) => void;
  };
}



