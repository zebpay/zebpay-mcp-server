/*
  Basic metrics collection for monitoring tool usage and performance.
*/

interface Metric {
  toolName: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  errorType?: string;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  record(
    toolName: string,
    durationMs: number,
    success: boolean,
    errorType?: string
  ): void {
    this.metrics.push({
      toolName,
      timestamp: Date.now(),
      durationMs,
      success,
      errorType,
    });

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get metrics summary for a tool
   */
  getToolStats(toolName: string, timeWindowMs?: number): {
    count: number;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
  } {
    const now = Date.now();
    const window = timeWindowMs || Infinity;
    const relevant = this.metrics.filter(
      (m) =>
        m.toolName === toolName && now - m.timestamp < window
    );

    if (relevant.length === 0) {
      return {
        count: 0,
        successCount: 0,
        errorCount: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
      };
    }

    const successCount = relevant.filter((m) => m.success).length;
    const durations = relevant.map((m) => m.durationMs);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: relevant.length,
      successCount,
      errorCount: relevant.length - successCount,
      avgDurationMs: sum / relevant.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
    };
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(new Set(this.metrics.map((m) => m.toolName)));
  }

  /**
   * Get overall stats
   */
  getOverallStats(timeWindowMs?: number): {
    totalRequests: number;
    successRate: number;
    avgDurationMs: number;
    toolStats: Record<string, ReturnType<MetricsCollector["getToolStats"]>>;
  } {
    const now = Date.now();
    const window = timeWindowMs || Infinity;
    const relevant = this.metrics.filter((m) => now - m.timestamp < window);

    if (relevant.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        avgDurationMs: 0,
        toolStats: {},
      };
    }

    const successCount = relevant.filter((m) => m.success).length;
    const durations = relevant.map((m) => m.durationMs);
    const sum = durations.reduce((a, b) => a + b, 0);

    const toolStats: Record<string, ReturnType<typeof this.getToolStats>> = {};
    for (const toolName of this.getToolNames()) {
      toolStats[toolName] = this.getToolStats(toolName, timeWindowMs);
    }

    return {
      totalRequests: relevant.length,
      successRate: successCount / relevant.length,
      avgDurationMs: sum / relevant.length,
      toolStats,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

