# 🔧 Log Tracking Scripts

Easy-to-use scripts for tracking API requests and responses.

## 🚀 Quick Commands

| Command | Description |
|---------|-------------|
| `npm run logs` | View all logs (formatted & colored) |
| `npm run logs:watch` | Watch logs in real-time (live tail) |
| `npm run logs:errors` | Show only errors |
| `npm run logs:http` | Show only HTTP logs |
| `npm run logs:mcp` | Show only MCP tool logs |
| `npm run logs:stats` | Show statistics dashboard |
| `npm run logs:clear` | Archive and clear logs |

## 📖 Scripts

### 1. log-viewer.js
**Interactive log viewer with filtering and formatting**

```bash
# Basic usage
node scripts/log-viewer.js

# Filter by type
node scripts/log-viewer.js --type=http
node scripts/log-viewer.js --type=mcp

# Filter by symbol
node scripts/log-viewer.js --symbol=BTC-INR

# Filter by tool
node scripts/log-viewer.js --tool=placeMarketOrder

# Watch mode (live updates)
node scripts/log-viewer.js --watch

# Last N entries
node scripts/log-viewer.js --last=50

# Combine filters
node scripts/log-viewer.js --symbol=BTC-INR --errors --watch
```

### 2. log-stats.js
**Statistics dashboard showing API usage metrics**

```bash
# View dashboard
node scripts/log-stats.js

# JSON output
node scripts/log-stats.js --json
```

### 3. clear-logs.js
**Archive or delete log files**

```bash
# Archive and clear
node scripts/clear-logs.js

# Force delete
node scripts/clear-logs.js --force
```

## 💡 Examples

### Track a specific order
```bash
# Watch for BTC-INR orders in real-time
node scripts/log-viewer.js --symbol=BTC-INR --watch
```

### Debug errors
```bash
# Show only errors
npm run logs:errors

# Show last 20 errors
node scripts/log-viewer.js --errors --last=20
```

### Monitor performance
```bash
# View statistics
npm run logs:stats

# Watch HTTP responses with timing
node scripts/log-viewer.js --type=http_response --watch
```

### Track specific request
```bash
# Use correlation ID to track entire flow
node scripts/log-viewer.js --correlation=abc123def456
```

## 📝 More Information

See the full documentation: [docs/LOGGING.md](../docs/LOGGING.md)

