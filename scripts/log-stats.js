#!/usr/bin/env node
/**
 * Log Statistics Dashboard
 * 
 * Shows a summary of all requests, responses, errors, and performance metrics
 * 
 * Usage:
 *   node scripts/log-stats.js
 *   node scripts/log-stats.js --json    # Output as JSON
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');

const logPath = resolve('logs/mcp-server.log');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text, color) {
  if (jsonOutput) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function analyzeLogs() {
  if (!existsSync(logPath)) {
    console.error(colorize(`Error: Log file not found at ${logPath}`, 'red'));
    process.exit(1);
  }

  const content = readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  const stats = {
    total: 0,
    http: {
      requests: 0,
      responses: 0,
      errors: 0,
      byStatus: {},
      byMethod: {},
      avgDuration: 0,
      totalDuration: 0,
    },
    mcp: {
      requests: 0,
      responses: 0,
      errors: 0,
      byTool: {},
      avgDuration: 0,
      totalDuration: 0,
    },
    errors: {
      total: 0,
      byType: {},
      httpErrors: [],
      mcpErrors: [],
    },
    symbols: {},
    correlations: new Set(),
  };
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      stats.total++;
      
      // Correlation tracking
      if (entry.correlationId) {
        stats.correlations.add(entry.correlationId);
      }
      
      // Symbol tracking
      if (entry.params?.symbol) {
        stats.symbols[entry.params.symbol] = (stats.symbols[entry.params.symbol] || 0) + 1;
      }
      
      // HTTP tracking
      if (entry.type === 'http_request') {
        stats.http.requests++;
        if (entry.method) {
          stats.http.byMethod[entry.method] = (stats.http.byMethod[entry.method] || 0) + 1;
        }
      }
      
      if (entry.type === 'http_response') {
        stats.http.responses++;
        if (entry.status) {
          const statusRange = `${Math.floor(entry.status / 100)}xx`;
          stats.http.byStatus[statusRange] = (stats.http.byStatus[statusRange] || 0) + 1;
        }
        if (entry.durationMs) {
          stats.http.totalDuration += entry.durationMs;
        }
      }
      
      if (entry.type === 'http_error') {
        stats.http.errors++;
        stats.errors.total++;
        stats.errors.httpErrors.push({
          url: entry.url,
          method: entry.method,
          error: entry.error,
          timestamp: entry.timestamp,
        });
        stats.errors.byType['http_error'] = (stats.errors.byType['http_error'] || 0) + 1;
      }
      
      // MCP tracking
      if (entry.type === 'mcp_request') {
        stats.mcp.requests++;
        if (entry.tool) {
          stats.mcp.byTool[entry.tool] = (stats.mcp.byTool[entry.tool] || 0) + 1;
        }
      }
      
      if (entry.type === 'mcp_response') {
        stats.mcp.responses++;
        if (entry.durationMs) {
          stats.mcp.totalDuration += entry.durationMs;
        }
      }
      
      if (entry.type === 'mcp_error') {
        stats.mcp.errors++;
        stats.errors.total++;
        stats.errors.mcpErrors.push({
          tool: entry.tool,
          error: entry.error,
          errorCode: entry.errorCode,
          timestamp: entry.timestamp,
        });
        stats.errors.byType['mcp_error'] = (stats.errors.byType['mcp_error'] || 0) + 1;
      }
      
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  // Calculate averages
  stats.http.avgDuration = stats.http.responses > 0 
    ? (stats.http.totalDuration / stats.http.responses).toFixed(2)
    : 0;
  
  stats.mcp.avgDuration = stats.mcp.responses > 0
    ? (stats.mcp.totalDuration / stats.mcp.responses).toFixed(2)
    : 0;
  
  stats.correlations = stats.correlations.size;
  
  return stats;
}

function displayStats(stats) {
  if (jsonOutput) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  
  console.log('\n' + colorize('═'.repeat(80), 'cyan'));
  console.log(colorize('  ZEBPAY MCP SERVER - LOG STATISTICS', 'bright'));
  console.log(colorize('═'.repeat(80), 'cyan') + '\n');
  
  // Overview
  console.log(colorize('📊 OVERVIEW', 'bright'));
  console.log(`  Total Log Entries: ${colorize(stats.total, 'cyan')}`);
  console.log(`  Unique Requests: ${colorize(stats.correlations, 'cyan')}`);
  console.log(`  Total Errors: ${colorize(stats.errors.total, stats.errors.total > 0 ? 'red' : 'green')}\n`);
  
  // HTTP Statistics
  console.log(colorize('🌐 HTTP STATISTICS', 'bright'));
  console.log(`  Requests: ${colorize(stats.http.requests, 'cyan')}`);
  console.log(`  Responses: ${colorize(stats.http.responses, 'cyan')}`);
  console.log(`  Errors: ${colorize(stats.http.errors, stats.http.errors > 0 ? 'red' : 'green')}`);
  console.log(`  Avg Duration: ${colorize(stats.http.avgDuration + 'ms', 'cyan')}`);
  
  if (Object.keys(stats.http.byMethod).length > 0) {
    console.log(`\n  ${colorize('By Method:', 'yellow')}`);
    for (const [method, count] of Object.entries(stats.http.byMethod)) {
      console.log(`    ${method}: ${colorize(count, 'cyan')}`);
    }
  }
  
  if (Object.keys(stats.http.byStatus).length > 0) {
    console.log(`\n  ${colorize('By Status:', 'yellow')}`);
    for (const [status, count] of Object.entries(stats.http.byStatus)) {
      const color = status.startsWith('2') ? 'green' : status.startsWith('4') || status.startsWith('5') ? 'red' : 'yellow';
      console.log(`    ${status}: ${colorize(count, color)}`);
    }
  }
  
  // MCP Statistics
  console.log('\n' + colorize('🔧 MCP TOOL STATISTICS', 'bright'));
  console.log(`  Requests: ${colorize(stats.mcp.requests, 'cyan')}`);
  console.log(`  Responses: ${colorize(stats.mcp.responses, 'cyan')}`);
  console.log(`  Errors: ${colorize(stats.mcp.errors, stats.mcp.errors > 0 ? 'red' : 'green')}`);
  console.log(`  Avg Duration: ${colorize(stats.mcp.avgDuration + 'ms', 'cyan')}`);
  
  if (Object.keys(stats.mcp.byTool).length > 0) {
    console.log(`\n  ${colorize('By Tool:', 'yellow')}`);
    const sortedTools = Object.entries(stats.mcp.byTool)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    for (const [tool, count] of sortedTools) {
      console.log(`    ${tool}: ${colorize(count, 'cyan')}`);
    }
  }
  
  // Trading Symbols
  if (Object.keys(stats.symbols).length > 0) {
    console.log('\n' + colorize('📈 TRADING SYMBOLS', 'bright'));
    const sortedSymbols = Object.entries(stats.symbols)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    for (const [symbol, count] of sortedSymbols) {
      console.log(`  ${symbol}: ${colorize(count, 'cyan')}`);
    }
  }
  
  // Recent Errors
  if (stats.errors.total > 0) {
    console.log('\n' + colorize('⚠️  RECENT ERRORS', 'bright'));
    
    if (stats.errors.httpErrors.length > 0) {
      console.log(`\n  ${colorize('HTTP Errors (last 5):', 'red')}`);
      stats.errors.httpErrors.slice(-5).forEach((err) => {
        const time = new Date(err.timestamp).toLocaleTimeString();
        console.log(`    [${colorize(time, 'gray')}] ${err.method} ${err.url}`);
        console.log(`      ${colorize(err.error, 'red')}`);
      });
    }
    
    if (stats.errors.mcpErrors.length > 0) {
      console.log(`\n  ${colorize('MCP Errors (last 5):', 'red')}`);
      stats.errors.mcpErrors.slice(-5).forEach((err) => {
        const time = new Date(err.timestamp).toLocaleTimeString();
        console.log(`    [${colorize(time, 'gray')}] ${err.tool}`);
        console.log(`      ${colorize(err.error, 'red')} ${err.errorCode ? `(Code: ${err.errorCode})` : ''}`);
      });
    }
  }
  
  console.log('\n' + colorize('═'.repeat(80), 'cyan') + '\n');
}

// Main
const stats = analyzeLogs();
displayStats(stats);

