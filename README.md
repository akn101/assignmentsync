# AssignmentSync - Microsoft Teams Education API Integration

Automatically sync Microsoft Teams assignments with Notion and export to multiple formats.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run sync (auto-extracts tokens locally if needed)
node sync-assignments.mjs --refresh-tokens

# Regular sync with existing tokens
node sync-assignments.mjs
```

## 📁 Core Files

- **`sync-assignments.mjs`** - Main sync script with full functionality
- **`simple-edge-extractor.mjs`** - Automated token extraction using Edge
- **`.env`** - Configuration (tokens, Notion settings)

## 🔐 Token Refresh Behavior

- Local runs will auto-refresh tokens when they are missing or expired.
- CI runs (GitHub Actions) will not auto-launch a browser; provide `AUI_TOKEN`/`AUI_SESSION_ID` via secrets.
- Set `AUI_AUTO_REFRESH=0` to disable local auto-refresh.

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

## 🗂️ Archive

Old files moved to `archive/`:
- `old-extractors/` - Previous token extraction attempts
- `tests/` - Test scripts and abandoned approaches
- `docs/` - Original documentation
- `samples/` - Sample API responses
