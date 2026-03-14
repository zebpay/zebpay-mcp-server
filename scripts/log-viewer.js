#!/usr/bin/env node
/**
 * Log Viewer - Easy tracking of API requests and responses
 * 
 * Usage:
 *   node scripts/log-viewer.js                    # View all logs
 *   node scripts/log-viewer.js --type=http        # Only HTTP logs
 *   node scripts/log-viewer.js --type=mcp         # Only MCP logs
 *   node scripts/log-viewer.js --errors           # Only errors
 *   node scripts/log-viewer.js --symbol=BTC-INR   # Filter by symbol
 *   node scripts/log-viewer.js --last=50          # Last 50 entries
 *   node scripts/log-viewer.js --watch            # Watch mode (tail -f)
 *   node scripts/log-viewer.js --tool=placeMarketOrder  # Filter by tool
 */

import { readFileSync, existsSync, watchFile } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const options = {
  type: getArg('type'),              // http, mcp, http_request, http_response, etc.
  errors: hasFlag('errors'),         // Show only errors
  symbol: getArg('symbol'),          // Filter by trading symbol
  tool: getArg('tool'),              // Filter by tool name
  last: parseInt(getArg('last')) || null,  // Show last N entries
  watch: hasFlag('watch'),           // Watch mode
  raw: hasFlag('raw'),               // Show raw JSON
  correlationId: getArg('correlation'), // Filter by correlation ID
};

const logPath = resolve('logs/mcp-server.log');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function getArg(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function formatLog(logEntry) {
  if (options.raw) {
    return JSON.stringify(logEntry, null, 2);
  }

  const timestamp = new Date(logEntry.timestamp).toLocaleString();
  const level = logEntry.level?.toUpperCase() || 'INFO';
  
  // Level colors
  let levelColor = 'white';
  if (level === 'ERROR') levelColor = 'red';
  else if (level === 'WARN') levelColor = 'yellow';
  else if (level === 'INFO') levelColor = 'green';
  else if (level === 'DEBUG') levelColor = 'blue';
  
  const levelText = colorize(level.padEnd(5), levelColor);
  const timeText = colorize(timestamp, 'gray');
  
  // Format based on log type
  if (logEntry.type === 'http_request') {
    return [
      `${levelText} ${timeText} ${colorize('HTTP REQUEST', 'cyan')}`,
      `  ${colorize(logEntry.method, 'bright')} ${logEntry.url}`,
      `  ${colorize('Headers:', 'dim')} ${JSON.stringify(logEntry.headers)}`,
      logEntry.body ? `  ${colorize('Body:', 'dim')} ${JSON.stringify(logEntry.body)}` : '',
    ].filter(Boolean).join('\n');
  }
  
  if (logEntry.type === 'http_response') {
    const statusColor = logEntry.status >= 400 ? 'red' : 'green';
    return [
      `${levelText} ${timeText} ${colorize('HTTP RESPONSE', 'cyan')}`,
      `  ${colorize(logEntry.method, 'bright')} ${logEntry.url}`,
      `  ${colorize('Status:', 'dim')} ${colorize(logEntry.status, statusColor)} (${logEntry.durationMs}ms)`,
      `  ${colorize('Headers:', 'dim')} ${JSON.stringify(logEntry.headers)}`,
      logEntry.body ? `  ${colorize('Body:', 'dim')} ${JSON.stringify(logEntry.body).substring(0, 200)}${JSON.stringify(logEntry.body).length > 200 ? '...' : ''}` : '',
    ].filter(Boolean).join('\n');
  }
  
  if (logEntry.type === 'http_error') {
    return [
      `${levelText} ${timeText} ${colorize('HTTP ERROR', 'red')}`,
      `  ${colorize(logEntry.method, 'bright')} ${logEntry.url}`,
      `  ${colorize('Error:', 'red')} ${logEntry.error}`,
      `  ${colorize('Duration:', 'dim')} ${logEntry.durationMs}ms`,
      logEntry.stack ? `  ${colorize('Stack:', 'dim')} ${logEntry.stack.split('\n')[0]}` : '',
    ].filter(Boolean).join('\n');
  }
  
  if (logEntry.type === 'mcp_request') {
    return [
      `${levelText} ${timeText} ${colorize('MCP REQUEST', 'magenta')}`,
      `  ${colorize('Tool:', 'bright')} ${logEntry.tool}`,
      `  ${colorize('Correlation:', 'dim')} ${logEntry.correlationId}`,
      `  ${colorize('Params:', 'dim')} ${JSON.stringify(logEntry.params)}`,
    ].filter(Boolean).join('\n');
  }
  
  if (logEntry.type === 'mcp_response') {
    return [
      `${levelText} ${timeText} ${colorize('MCP RESPONSE', 'magenta')}`,
      `  ${colorize('Tool:', 'bright')} ${logEntry.tool}`,
      `  ${colorize('Correlation:', 'dim')} ${logEntry.correlationId}`,
      `  ${colorize('Duration:', 'dim')} ${logEntry.durationMs}ms`,
      `  ${colorize('Success:', 'green')} ${logEntry.success}`,
      logEntry.result ? `  ${colorize('Result:', 'dim')} ${JSON.stringify(logEntry.result).substring(0, 200)}${JSON.stringify(logEntry.result).length > 200 ? '...' : ''}` : '',
    ].filter(Boolean).join('\n');
  }
  
  if (logEntry.type === 'mcp_error') {
    return [
      `${levelText} ${timeText} ${colorize('MCP ERROR', 'red')}`,
      `  ${colorize('Tool:', 'bright')} ${logEntry.tool}`,
      `  ${colorize('Correlation:', 'dim')} ${logEntry.correlationId}`,
      `  ${colorize('Error:', 'red')} ${logEntry.error}`,
      logEntry.errorCode ? `  ${colorize('Error Code:', 'dim')} ${logEntry.errorCode}` : '',
      `  ${colorize('Duration:', 'dim')} ${logEntry.durationMs}ms`,
    ].filter(Boolean).join('\n');
  }
  
  // Default format
  return `${levelText} ${timeText} ${colorize(logEntry.type || 'LOG', 'white')} ${JSON.stringify(logEntry)}`;
}

function matchesFilters(logEntry) {
  // Type filter
  if (options.type) {
    const typeFilter = options.type.toLowerCase();
    const logType = (logEntry.type || '').toLowerCase();
    
    if (typeFilter === 'http' && !logType.startsWith('http')) return false;
    if (typeFilter === 'mcp' && !logType.startsWith('mcp')) return false;
    if (typeFilter !== 'http' && typeFilter !== 'mcp' && logType !== typeFilter) return false;
  }
  
  // Error filter
  if (options.errors && logEntry.level !== 'error' && !logEntry.type?.includes('error')) {
    return false;
  }
  
  // Symbol filter
  if (options.symbol) {
    const logText = JSON.stringify(logEntry).toLowerCase();
    if (!logText.includes(options.symbol.toLowerCase())) return false;
  }
  
  // Tool filter
  if (options.tool && logEntry.tool?.toLowerCase() !== options.tool.toLowerCase()) {
    return false;
  }
  
  // Correlation ID filter
  if (options.correlationId && logEntry.correlationId !== options.correlationId) {
    return false;
  }
  
  return true;
}

function processLogs(content) {
  const lines = content.trim().split('\n').filter(Boolean);
  const entries = [];
  
  for (const line of lines) {
    try {
      const logEntry = JSON.parse(line);
      if (matchesFilters(logEntry)) {
        entries.push(logEntry);
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }
  
  // Apply "last N" filter
  const filteredEntries = options.last ? entries.slice(-options.last) : entries;
  
  return filteredEntries;
}

function displayLogs(entries) {
  if (entries.length === 0) {
    console.log(colorize('No logs found matching the filters.', 'yellow'));
    return;
  }
  
  console.log(colorize(`\n${'='.repeat(80)}`, 'gray'));
  console.log(colorize(`  Found ${entries.length} log entries`, 'bright'));
  console.log(colorize(`${'='.repeat(80)}\n`, 'gray'));
  
  for (const entry of entries) {
    console.log(formatLog(entry));
    console.log(''); // Blank line between entries
  }
}

function printHelp() {
  console.log(`
${colorize('Zebpay MCP Server Log Viewer', 'bright')}

${colorize('Usage:', 'cyan')}
  node scripts/log-viewer.js [options]

${colorize('Options:', 'cyan')}
  --type=TYPE              Filter by log type (http, mcp, http_request, http_response, etc.)
  --errors                 Show only errors
  --symbol=SYMBOL          Filter by trading symbol (e.g., BTC-INR)
  --tool=TOOL              Filter by MCP tool name (e.g., placeMarketOrder)
  --correlation=ID         Filter by correlation ID
  --last=N                 Show last N entries
  --watch                  Watch mode (live tail)
  --raw                    Show raw JSON output
  --help                   Show this help message

${colorize('Examples:', 'cyan')}
  node scripts/log-viewer.js --type=http --last=20
  node scripts/log-viewer.js --errors
  node scripts/log-viewer.js --symbol=BTC-INR --watch
  node scripts/log-viewer.js --tool=zebpay_spot_placeMarketOrder
  node scripts/log-viewer.js --correlation=abc123def456
`);
}

// Main
if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

if (!existsSync(logPath)) {
  console.error(colorize(`Error: Log file not found at ${logPath}`, 'red'));
  console.error(colorize('Make sure the server has been started and logs are being written.', 'yellow'));
  process.exit(1);
}

if (options.watch) {
  console.log(colorize(`Watching ${logPath}...`, 'cyan'));
  console.log(colorize('Press Ctrl+C to exit\n', 'gray'));
  
  let lastSize = 0;
  
  watchFile(logPath, { interval: 500 }, (curr, prev) => {
    if (curr.size > lastSize) {
      const content = readFileSync(logPath, 'utf-8');
      const newContent = content.slice(lastSize);
      lastSize = curr.size;
      
      const entries = processLogs(newContent);
      if (entries.length > 0) {
        for (const entry of entries) {
          console.log(formatLog(entry));
          console.log('');
        }
      }
    }
  });
  
  // Display existing logs first
  const content = readFileSync(logPath, 'utf-8');
  lastSize = content.length;
  const entries = processLogs(content);
  displayLogs(entries);
} else {
  const content = readFileSync(logPath, 'utf-8');
  const entries = processLogs(content);
  displayLogs(entries);
}

