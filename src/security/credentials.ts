/*
  Credential provider abstraction. Current implementation reads from env vars.
  Secrets are never logged directly; use redact() for any visibility.
*/

import { redact } from "../config.js";

export interface CredentialsProvider {
  getApiKey(): string;
  getSecretKey(): string;
}

export class EnvCredentialsProvider implements CredentialsProvider {
  private readonly apiKeyEnv: string;
  private readonly secretKeyEnv: string;

  constructor(
    apiKeyEnvName: string = "ZEBPAY_API_KEY",
    secretKeyEnvName: string = "ZEBPAY_API_SECRET"
  ) {
    this.apiKeyEnv = apiKeyEnvName;
    this.secretKeyEnv = secretKeyEnvName;
  }

  getApiKey(): string {
    const value = process.env[this.apiKeyEnv];
    if (!value) {
      throw new Error(
        `Missing API key in env ${this.apiKeyEnv}. Configure securely.`
      );
    }
    return value;
  }

  getSecretKey(): string {
    const value = process.env[this.secretKeyEnv];
    if (!value) {
      throw new Error(
        `Missing API secret in env ${this.secretKeyEnv}. Configure securely.`
      );
    }
    return value;
  }

  /**
   * Returns safe-to-log shapes for debugging without exposing secrets.
   */
  describeRedacted(): { apiKey: string; secretKey: string } {
    return {
      apiKey: redact(process.env[this.apiKeyEnv] ?? ""),
      secretKey: redact(process.env[this.secretKeyEnv] ?? ""),
    };
  }
}

/**
 * Credentials provider that stores credentials in memory.
 * Used for accepting credentials from client during initialization.
 * Credentials are optional - if not provided, authenticated tools will fail with a clear error.
 */
export class InMemoryCredentialsProvider implements CredentialsProvider {
  private apiKey: string | undefined;
  private secretKey: string | undefined;

  constructor(apiKey?: string, secretKey?: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }

  setCredentials(apiKey: string, secretKey: string): void {
    if (!apiKey || !secretKey) {
      throw new Error("API key and secret are required.");
    }
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }

  getApiKey(): string {
    if (!this.apiKey) {
      throw new Error(
        "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET headers or include credentials in initialization params."
      );
    }
    return this.apiKey;
  }

  getSecretKey(): string {
    if (!this.secretKey) {
      throw new Error(
        "API credentials are required for this operation. Please provide ZEBPAY_API_KEY and ZEBPAY_API_SECRET headers or include credentials in initialization params."
      );
    }
    return this.secretKey;
  }

  /**
   * Returns safe-to-log shapes for debugging without exposing secrets.
   */
  describeRedacted(): { apiKey: string; secretKey: string } {
    return {
      apiKey: redact(this.apiKey),
      secretKey: redact(this.secretKey),
    };
  }

  /**
   * Check if credentials are set
   */
  hasCredentials(): boolean {
    return !!(this.apiKey && this.secretKey);
  }
}


