# Automated Teams Token Extraction

This system automatically extracts authentication tokens from Microsoft Teams using Chrome DevTools Protocol.

## Quick Start

### Option 1: Auto-refresh during sync (Recommended)
```bash
node sync-assignments.mjs --refresh-tokens
```

### Option 2: Extract tokens manually
```bash
node extract-tokens.js
```

### Option 3: Use npm scripts
```bash
npm run sync:refresh          # Sync with token refresh
npm run extract-tokens        # Extract tokens only
npm run launch-teams          # Launch Teams with debugging
```

## How It Works

1. **Launches Teams with debugging**: Starts Microsoft Teams with `--remote-debugging-port=9222`
2. **Connects via Chrome DevTools Protocol**: Establishes WebSocket connection to Teams
3. **Navigates to assignments**: Automatically triggers assignments page loading
4. **Monitors network requests**: Captures all API calls to `assignments.onenote.com`
5. **Extracts authentication headers**: Grabs `Authorization: Bearer` and `x-usersessionid`
6. **Updates .env file**: Automatically saves fresh tokens for immediate use

## Features

- ✅ **Fully automated** - No manual token copying
- ✅ **Token validation** - Checks JWT expiry before use
- ✅ **Integrated with sync** - Use `--refresh-tokens` flag
- ✅ **Safe process management** - Properly handles Teams launch/cleanup
- ✅ **Error handling** - Graceful fallbacks and timeouts
- ✅ **Real-time monitoring** - Shows progress and extracted data

## Manual Method (Backup)

If automated extraction fails:

1. Launch Teams with debugging:
   ```bash
   ./launch-teams-debug.sh --wait
   ```

2. Open browser DevTools on Teams:
   - Go to `http://localhost:9222` (if available)
   - Or use browser's built-in DevTools

3. Navigate to assignments in Teams

4. Find network requests to `assignments.onenote.com`

5. Copy `Authorization` header and update `.env` manually

## Troubleshooting

- **"Failed to connect to debugger"**: Teams may not have started yet, wait longer
- **"No assignments API calls detected"**: Try manually clicking assignments in Teams
- **"Token validation failed"**: Token may have expired during extraction
- **"Permission denied"**: Make sure `launch-teams-debug.sh` is executable (`chmod +x`)

## Security Notes

- Tokens are stored in `.env` file (add to `.gitignore`)
- Scripts only run on your local machine
- Teams process is properly cleaned up after extraction
- No tokens are sent to external services