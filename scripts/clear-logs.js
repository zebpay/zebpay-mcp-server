#!/usr/bin/env node
/**
 * Clear or rotate log files
 * 
 * Usage:
 *   node scripts/clear-logs.js           # Archive current logs and start fresh
 *   node scripts/clear-logs.js --force   # Delete logs without archiving
 */

import { existsSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const force = args.includes('--force');

const logPath = resolve('logs/mcp-server.log');
const archivePath = resolve(`logs/mcp-server-${Date.now()}.log`);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

if (!existsSync(logPath)) {
  console.log(colorize('No log file found. Nothing to clear.', 'yellow'));
  process.exit(0);
}

if (force) {
  console.log(colorize('⚠️  Force delete mode - logs will be permanently deleted!', 'red'));
  console.log(colorize('Deleting log file...', 'yellow'));
  unlinkSync(logPath);
  console.log(colorize('✅ Log file deleted successfully!', 'green'));
} else {
  console.log(colorize('Archiving current log file...', 'cyan'));
  renameSync(logPath, archivePath);
  console.log(colorize(`✅ Logs archived to: ${archivePath}`, 'green'));
  
  // Create new empty log file
  writeFileSync(logPath, '');
  console.log(colorize('✅ New log file created!', 'green'));
}

console.log(colorize('\nLog files cleared successfully!', 'green'));

