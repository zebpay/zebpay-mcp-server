/*
  Centralized configuration loading and validation.
  Secrets are never logged; use redact() when including values in logs.
*/

export type TransportKind = "stdio";

export interface SigningHeaderNames {
  apiKeyHeader: string;
  signatureHeader: string;
  timestampHeader: string;
}

const SIGNING_HEADERS: SigningHeaderNames = {
  apiKeyHeader: "X-AUTH-APIKEY",
  signatureHeader: "X-AUTH-SIGNATURE",
  timestampHeader: "",
};

export interface AppConfig {
  spotBaseUrl: string;
  futuresBaseUrl: string;
  marketBaseUrl: string;
  transports: TransportKind[];
  logLevel: "debug" | "info" | "warn" | "error";
  logFile?: string; // Optional log file path
  signingHeaders: SigningHeaderNames;
  timeoutMs: number;
  retryCount: number;
}

export function redact(value: string | undefined | null, show: number = 4): string {
  if (!value) return "<redacted>";
  if (value.length <= show) return "*".repeat(value.length);
  return `${value.slice(0, show)}${"*".repeat(Math.max(4, value.length - show))}`;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseTransports(input: string | undefined): TransportKind[] {
  const raw = (input ?? "stdio").split(",").map((s) => s.trim()).filter(Boolean);
  const valid: TransportKind[] = [];
  for (const t of raw) {
    if (t === "stdio") valid.push(t);
  }

  if (!valid.length) {
    throw new Error('Invalid MCP_TRANSPORTS. Only "stdio" is supported.');
  }
  return valid;
}

function parseLogLevel(input: string | undefined): AppConfig["logLevel"] {
  if (input === undefined) return "info";
  if (input === "debug" || input === "info" || input === "warn" || input === "error") {
    return input;
  }
  throw new Error('Invalid LOG_LEVEL. Use one of: "debug", "info", "warn", "error".');
}

export function getConfig(): AppConfig {
  const spotBaseUrl = getRequiredEnv("ZEBPAY_SPOT_BASE_URL") || 'https://www.zebapi.com/api/v2';
  const futuresBaseUrl = getRequiredEnv("ZEBPAY_FUTURES_BASE_URL") || 'https://futures-api.zebpay.com/api/v1';
  const marketBaseUrl = getRequiredEnv("ZEBPAY_MARKET_BASE_URL") || 'https://www.zebapi.com/api/v1/market';
  const transports = parseTransports(process.env.MCP_TRANSPORTS);
  const logLevel = parseLogLevel(process.env.LOG_LEVEL);
  const logFile = process.env.LOG_FILE; // Optional log file path
  const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS ?? 15000);
  const retryCount = Number(process.env.HTTP_RETRY_COUNT ?? 2);

  const signingHeaders: SigningHeaderNames = SIGNING_HEADERS;

  if (!spotBaseUrl.startsWith("http")) {
    throw new Error("Invalid spot base URL");
  }
  if (!futuresBaseUrl.startsWith("http")) {
    throw new Error("Invalid futures base URL");
  }
  if (!marketBaseUrl.startsWith("http")) {
    throw new Error("Invalid market base URL");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Invalid HTTP_TIMEOUT_MS");
  }
  if (!Number.isFinite(retryCount) || retryCount < 0) {
    throw new Error("Invalid HTTP_RETRY_COUNT");
  }

  return {
    spotBaseUrl,
    futuresBaseUrl,
    marketBaseUrl,
    transports,
    logLevel,
    logFile,
    signingHeaders,
    timeoutMs,
    retryCount,
  };
}


