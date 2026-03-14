# 📋 Logging & Request/Response Tracking Guide

This guide shows you how to easily track and analyze all API requests and responses without dealing with messy console.log output.

## 🚀 Quick Start

### View All Logs (Pretty Format)
```bash
npm run logs
```

### Watch Logs in Real-Time (Live Updates)
```bash
npm run logs:watch
```

### View Only Errors
```bash
npm run logs:errors
```

### View Statistics Dashboard
```bash
npm run logs:stats
```

---

## 📊 Log Viewer Commands

The log viewer provides powerful filtering and formatting capabilities:

### Basic Usage

```bash
# View all logs (formatted and colored)
npm run logs

# View only HTTP requests/responses
npm run logs:http

# View only MCP tool calls
npm run logs:mcp

# View only errors
npm run logs:errors

# Watch logs live (tail -f style)
npm run logs:watch
```

### Advanced Filtering

```bash
# Filter by trading symbol
node scripts/log-viewer.js --symbol=BTC-INR

# Filter by specific tool
node scripts/log-viewer.js --tool=zebpay_spot_placeMarketOrder

# Show last 50 entries
node scripts/log-viewer.js --last=50

# Filter by correlation ID (track a specific request through the system)
node scripts/log-viewer.js --correlation=abc123def456

# Combine filters
node scripts/log-viewer.js --type=http --errors --last=20

# Watch with filters
node scripts/log-viewer.js --symbol=BTC-INR --watch
```

### Output Options

```bash
# Raw JSON output (for piping to other tools)
node scripts/log-viewer.js --raw

# Show help
node scripts/log-viewer.js --help
```

---

## 📈 Log Statistics Dashboard

Get a comprehensive overview of all API activity:

```bash
npm run logs:stats
```

**Shows:**
- 📊 Total requests, responses, and errors
- 🌐 HTTP statistics (by method, status code, average duration)
- 🔧 MCP tool usage statistics
- 📈 Trading symbols usage
- ⚠️ Recent errors with details

**JSON Output for Integration:**
```bash
node scripts/log-stats.js --json > stats.json
```

---

## 🧹 Log Management

### Archive and Clear Logs

```bash
# Archive current logs and start fresh
npm run logs:clear

# Force delete without archiving
node scripts/clear-logs.js --force
```

---

## 💡 Common Use Cases

### 1. **Debug a Failing Order**

```bash
# Find all errors related to BTC-INR
node scripts/log-viewer.js --symbol=BTC-INR --errors

# Watch for new orders on BTC-INR
node scripts/log-viewer.js --symbol=BTC-INR --watch
```

### 2. **Track Specific Request**

Every request gets a `correlationId`. Use it to track the request through the entire system:

```bash
# Copy correlation ID from error message, then:
node scripts/log-viewer.js --correlation=abc123def456
```

This shows:
1. MCP request (tool call)
2. HTTP request (to Zebpay API)
3. HTTP response (from Zebpay)
4. MCP response (back to client)

### 3. **Monitor API Performance**

```bash
# View statistics
npm run logs:stats

# Watch HTTP requests live
node scripts/log-viewer.js --type=http_response --watch
```

### 4. **Debug Authentication Issues**

```bash
# View all HTTP errors
node scripts/log-viewer.js --type=http_error

# Filter for authentication-related errors
node scripts/log-viewer.js --errors | grep -i "auth\|401\|403"
```

### 5. **Track Specific Tool Usage**

```bash
# See all calls to a specific tool
node scripts/log-viewer.js --tool=zebpay_spot_placeMarketOrder

# Watch for new market orders
node scripts/log-viewer.js --tool=zebpay_spot_placeMarketOrder --watch
```

---

## 📝 Log Format

All logs are stored as **newline-delimited JSON** in `logs/mcp-server.log`.

### Log Types

#### 1. **HTTP Request**
```json
{
  "level": "info",
  "type": "http_request",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "method": "POST",
  "url": "https://api.zebpay.com/api/v2/ex/orders",
  "headers": { "..." },
  "body": { "symbol": "BTC-INR", "side": "BUY", "..." }
}
```

#### 2. **HTTP Response**
```json
{
  "level": "info",
  "type": "http_response",
  "timestamp": "2024-01-15T10:30:45.456Z",
  "method": "POST",
  "url": "https://api.zebpay.com/api/v2/ex/orders",
  "status": 200,
  "durationMs": 333,
  "body": { "data": { "orderId": "123", "..." } }
}
```

#### 3. **MCP Request** (Tool Call)
```json
{
  "level": "info",
  "type": "mcp_request",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "tool": "zebpay_spot_placeMarketOrder",
  "correlationId": "abc123def456",
  "params": { "symbol": "BTC-INR", "side": "BUY", "..." }
}
```

#### 4. **MCP Response**
```json
{
  "level": "info",
  "type": "mcp_response",
  "timestamp": "2024-01-15T10:30:45.500Z",
  "tool": "zebpay_spot_placeMarketOrder",
  "correlationId": "abc123def456",
  "success": true,
  "durationMs": 500,
  "result": { "..." }
}
```

#### 5. **Errors**
```json
{
  "level": "error",
  "type": "mcp_error" | "http_error",
  "timestamp": "2024-01-15T10:30:45.500Z",
  "error": "Error message",
  "errorCode": 400,
  "stack": "...",
  "..."
}
```

---

## 🎨 Color-Coded Output

The log viewer uses colors to make logs easier to read:

- 🟢 **Green**: Success (2xx status codes, INFO level)
- 🔴 **Red**: Errors (4xx/5xx status codes, ERROR level)
- 🟡 **Yellow**: Warnings
- 🔵 **Blue**: Debug information
- 🟣 **Magenta**: MCP tool calls
- 🔷 **Cyan**: HTTP requests/responses
- ⚪ **Gray**: Timestamps and metadata

---

## 🔧 Integration with External Tools

### Export to JSON for Analysis

```bash
# Export last 100 entries as JSON
node scripts/log-viewer.js --last=100 --raw > logs/export.json

# Export statistics
node scripts/log-stats.js --json > logs/stats.json
```

### Grep/Awk Integration

```bash
# Find all 500 errors
node scripts/log-viewer.js --type=http | grep "500"

# Count errors by type
node scripts/log-viewer.js --errors --raw | jq -r '.type' | sort | uniq -c
```

### Watch Specific Symbol

```bash
# Terminal 1: Watch logs
node scripts/log-viewer.js --symbol=BTC-INR --watch

# Terminal 2: Place orders
# ... your trading operations ...
```

---

## 🚨 Troubleshooting

### No logs appearing?

1. **Check if log file exists:**
   ```bash
   ls -lh logs/mcp-server.log
   ```

2. **Make sure server is running with logging enabled:**
   ```bash
   npm run start:log-append
   ```

3. **Check log path in code:**
   The log path is set in `src/index.ts` where `fileLogger.initialize()` is called.

### Logs too large?

```bash
# Archive and clear
npm run logs:clear

# View only recent entries
node scripts/log-viewer.js --last=100
```

### Can't find specific request?

Use correlation ID to track requests across the system:
```bash
# 1. Find the correlation ID in any log entry
# 2. Track it through the entire flow:
node scripts/log-viewer.js --correlation=YOUR_CORRELATION_ID
```

---

## 📖 Additional Resources

- **Main README**: `../README.md`
- **Log Source Code**:
  - HTTP Client: `src/http/httpClient.ts`
  - MCP Logging: `src/mcp/logging.ts`
  - File Logger: `src/utils/fileLogger.ts`

---

## 🎯 Best Practices

1. **Always use `--watch` during development** - See issues in real-time
2. **Use correlation IDs** - Track requests end-to-end
3. **Archive logs regularly** - Prevent log files from growing too large
4. **Filter by symbol** - Focus on specific trading pairs
5. **Check stats dashboard** - Get quick overview of system health

---

## 📞 Need Help?

If you're still having trouble tracking requests/responses:

1. Check the log viewer help: `node scripts/log-viewer.js --help`
2. Verify logs are being written: `tail -f logs/mcp-server.log`
3. Check for file permissions issues
4. Make sure the `logs/` directory exists

Happy tracking! 🎉

