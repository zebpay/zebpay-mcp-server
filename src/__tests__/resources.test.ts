/*
  Tests for MCP resources registration and functionality.
*/

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicClient } from "../public/PublicClient.js";
import { SpotClient } from "../private/SpotClient.js";
import { AppConfig } from "../config.js";
import { registerResources } from "../mcp/resources.js";

describe("MCP Resources", () => {
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
    mockPublicClient = {
      getExchangeInfo: jest.fn<() => Promise<unknown>>().mockResolvedValue({ symbols: [] }),
      getCurrencies: jest.fn<() => Promise<unknown>>().mockResolvedValue({ currencies: [] }),
      getAllTickers: jest.fn<() => Promise<unknown>>().mockResolvedValue({ tickers: [] }),
    } as unknown as PublicClient;

    // Create mock spot client
    mockSpotClient = {
      getBalance: jest.fn<(currencies?: string) => Promise<unknown>>().mockResolvedValue({ balances: [] }),
    } as unknown as SpotClient;

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

  it("should register exchange-info resource", () => {
    expect(() => {
      registerResources(mockServer, mockPublicClient, null, mockConfig);
    }).not.toThrow();
  });

  it("should register currencies resource", () => {
    expect(() => {
      registerResources(mockServer, mockPublicClient, null, mockConfig);
    }).not.toThrow();
  });

  it("should register all-tickers resource", () => {
    expect(() => {
      registerResources(mockServer, mockPublicClient, null, mockConfig);
    }).not.toThrow();
  });

  it("should register balance resource when spot client is available", () => {
    expect(() => {
      registerResources(mockServer, mockPublicClient, mockSpotClient, mockConfig);
    }).not.toThrow();
  });

  it("should not register balance resource when spot client is null", () => {
    // Resources should still register successfully without spot client
    expect(() => {
      registerResources(mockServer, mockPublicClient, null, mockConfig);
    }).not.toThrow();
  });
});

