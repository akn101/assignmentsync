# AssignmentSync - Microsoft Teams Education API Integration

Automatically sync Microsoft Teams assignments with Notion and export to multiple formats.

## 🚀 Quick Start (One-Click Setup)

```bash
# Enter your repo directory
cd assignmentsync

# One command to setup everything:
npm run setup
```

That's it! The setup script will:
- ✅ Install dependencies
- ✅ Create `.env` file
- ✅ Launch Edge to extract authentication tokens
- ✅ Validate your setup
- ✅ Optionally run your first sync

**After setup**, use these commands:

```bash
npm run sync              # Sync all assignments
npm run sync:full        # Full sync (ignore previous runs)
npm run sync:incremental # Only new assignments
npm run sync:refresh     # Refresh tokens and sync
npm run help             # Show all CLI options
```

## 📁 Core Files

- **`sync-assignments.mjs`** - Main sync script with full functionality
- **`simple-edge-extractor.mjs`** - Automated token extraction using Edge
- **`.env`** - Configuration (tokens, Notion settings)
- **`.env.example`** - Template showing all available configuration options
- **`setup.sh`** - One-click setup script (handles install, tokens, validation)

## 🔐 Authentication (Tokens)

The sync tool needs authentication tokens from Microsoft Teams. These are:
- **`AUI_TOKEN`** - Bearer token for API requests
- **`AUI_SESSION_ID`** - Session identifier for the API

**How to get them:**
```bash
# During setup (automatic):
npm run setup

# Or manually anytime:
npm run extract-tokens
```

The token extraction process:
1. Launches Microsoft Edge
2. Navigates to Teams Assignments 
3. Captures authentication tokens from API calls
4. Saves them to `.env` (automatically)
5. Tokens are valid for ~24 hours

**Auto-refresh behavior:**
- Local runs: Automatically refresh expired tokens
- CI/GitHub Actions: Must provide tokens via environment secrets
- Disable auto-refresh: Set `AUI_AUTO_REFRESH=0` in `.env`

## 🎯 Features

- ✅ **Auto token extraction** - Launches Edge, clicks assignments, captures tokens
- ✅ **Assignment descriptions** - Fetches detailed instructions to "Notes" field
- ✅ **Teacher name formatting** - "Page, Ben - BTP" → "Ben Page - BTP"
- ✅ **Multiple exports** - JSON, CSV, XLSX organized by year/month
- ✅ **Notion integration** - Automatic upload with duplicate detection
- ✅ **Incremental sync** - Track processed assignments
- ✅ **Rate limiting** - Respects API limits

## 📄 Output Files

- `outputs/assignments.json/csv/xlsx` - Main exports
- `outputs/by-year/2025/assignments.*` - Organized by year
- `outputs/by-month/2025/sep/assignments.*` - Organized by month
- `outputs/notion_payload.json` - Notion-ready data

## ❓ Troubleshooting

### Setup fails / tokens aren't captured
- **Issue**: Edge doesn't open or tokens don't save
- **Solution**: 
  ```bash
  # Try running token extraction manually
  npm run extract-tokens
  
  # Make sure you click on "Assignments" in Teams to trigger the API call
  # Wait for "Tokens saved" message in the terminal
  ```

### "Authorization failed" or 401 error
- **Issue**: Tokens are expired or invalid
- **Solution**: Refresh tokens with `npm run sync:refresh` or `npm run extract-tokens`

### .env file missing or empty
- **Issue**: Setup was skipped or incomplete
- **Solution**: 
  ```bash
  # Re-run setup from scratch
  npm run setup
  ```

### Need help with CLI options
- **Command**: `npm run help` or `node sync-assignments.mjs --help`
- **Examples** in sync-assignments.mjs top comments

## 🗂️ Archive

Old files moved to `archive/`:
- `old-extractors/` - Previous token extraction attempts
- `tests/` - Test scripts and abandoned approaches
- `docs/` - Original documentation
- `samples/` - Sample API responses
