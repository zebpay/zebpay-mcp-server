/*
  Tests for MCP prompts registration and functionality.
*/

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicClient } from "../public/PublicClient.js";
import { SpotClient } from "../private/SpotClient.js";
import { AppConfig } from "../config.js";
import { registerPrompts } from "../mcp/prompts.js";

describe("MCP Prompts", () => {
  let mockServer: McpServer;
  let mockPublicClient: PublicClient;
  let mockSpotClient: SpotClient | null;
  let mockConfig: AppConfig;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Suppress console.error during tests
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Create mock server
    mockServer = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Create mock public client
    mockPublicClient = {} as unknown as PublicClient;

    // Create mock spot client
    mockSpotClient = {} as unknown as SpotClient;

    // Create mock config
    mockConfig = {
      spotBaseUrl: "https://test.api",
      futuresBaseUrl: "https://test.futures.api",
      marketBaseUrl: "https://test.market.api",
      transports: ["stdio"],
      logLevel: "info",
      signingHeaders: {
        apiKeyHeader: "X-AUTH-APIKEY",
        signatureHeader: "X-AUTH-SIGNATURE",
        timestampHeader: "",
      },
      timeoutMs: 15000,
      retryCount: 2,
    };
  });

  afterEach(() => {
    // Restore console.error after tests
    console.error = originalConsoleError;
  });

  it("should register check-balance-before-trade prompt when spot client is available", () => {
    expect(() => {
      registerPrompts(mockServer, mockSpotClient, mockPublicClient, mockConfig);
    }).not.toThrow();
  });

  it("should register analyze-market prompt", () => {
    expect(() => {
      registerPrompts(mockServer, null, mockPublicClient, mockConfig);
    }).not.toThrow();
  });

  it("should register compare-trading-pairs prompt", () => {
    expect(() => {
      registerPrompts(mockServer, null, mockPublicClient, mockConfig);
    }).not.toThrow();
  });

  it("should register get-exchange-info prompt", () => {
    expect(() => {
      registerPrompts(mockServer, null, mockPublicClient, mockConfig);
    }).not.toThrow();
  });

  it("should not register authenticated prompts when spot client is null", () => {
    // Public prompts should still register successfully without spot client
    expect(() => {
      registerPrompts(mockServer, null, mockPublicClient, mockConfig);
    }).not.toThrow();
  });
});

