/*
  File logging utility for writing logs to both console and file.
*/

import { createWriteStream, WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

class FileLogger {
  private stream: WriteStream | null = null;
  private logPath: string | null = null;

  async initialize(logPath?: string): Promise<void> {
    if (!logPath) {
      // Default log path
      this.logPath = null;
      return;
    }

    try {
      // Ensure log directory exists
      const logDir = dirname(logPath);
      await mkdir(logDir, { recursive: true });
      
      // Create write stream in append mode
      this.stream = createWriteStream(logPath, { flags: "a" });
      this.logPath = logPath;
      
      // Write initial log entry
      this.writeToFile(JSON.stringify({
        level: "info",
        type: "log_init",
        timestamp: new Date().toISOString(),
        message: `Logging initialized to file: ${logPath}`,
      }) + "\n");
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        type: "log_init_error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
      // Continue without file logging if file can't be opened
      this.stream = null;
      this.logPath = null;
    }
  }

  log(message: string): void {
    // Always write to console.error
    console.error(message);
    
    // Also write to file if initialized
    if (this.stream) {
      this.writeToFile(message + "\n");
    }
  }

  private writeToFile(message: string): void {
    if (this.stream) {
      try {
        this.stream.write(message);
      } catch (error) {
        // If file write fails, log to console but don't crash
        console.error(JSON.stringify({
          level: "error",
          type: "log_write_error",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }

  async close(): Promise<void> {
    if (this.stream) {
      return new Promise((resolve) => {
        this.stream!.end(() => {
          this.stream = null;
          resolve();
        });
      });
    }
  }
}

export const fileLogger = new FileLogger();

