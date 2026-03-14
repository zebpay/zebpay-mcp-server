/*
  Simple in-memory cache for public endpoints to reduce API calls.
*/

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class SimpleCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 5000) {
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Get cached value if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached value with optional TTL
   */
  set(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs || this.defaultTtl,
    });
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Cache instances for different endpoint types
export const tickerCache = new SimpleCache(5000); // 5 seconds for tickers
export const orderBookCache = new SimpleCache(2000); // 2 seconds for order books
export const exchangeInfoCache = new SimpleCache(60000); // 1 minute for exchange info
export const currenciesCache = new SimpleCache(300000); // 5 minutes for currencies

// Clean up expired entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    tickerCache.clearExpired();
    orderBookCache.clearExpired();
    exchangeInfoCache.clearExpired();
    currenciesCache.clearExpired();
  }, 10000); // Clean every 10 seconds
}

