# 📚 Microsoft Teams Assignment Sync

Automatically sync Microsoft Teams assignments with comprehensive filtering, teacher information, and multiple output formats (JSON, XLSX, Notion-compatible).

## ✨ Features

- **🔄 Automated Token Refresh**: Uses Playwright to auto-extract fresh tokens when expired
- **👥 Rich Teacher Data**: Fetches teacher names, emails, and student counts
- **📊 Multiple Outputs**: JSON, Excel, and Notion-compatible formats
- **🔍 Advanced Filtering**: By date, status, class, completion, etc.
- **📈 Incremental Sync**: Only process new assignments with state tracking
- **☁️ Cloud Ready**: Supports VPS, GitHub Actions, and local deployment

## 🚀 Quick Start

### 1. Setup
```bash
# Clone and install
git clone <your-repo>
cd AssignmentSync
npm run setup
```

### 2. First Run (Automated)
```bash
# This will open a browser, let you log in, and auto-extract tokens
npm run sync

# Or use the shell script
./run.sh --full
```

### 3. Subsequent Runs
```bash
# Auto-sync with token refresh if needed
npm run sync:incremental

# Force full sync
npm run sync:full

# Manual token extraction only
npm run tokens
```

## 📋 Usage Options

### NPM Scripts (Recommended)
```bash
npm run sync              # Smart auto-sync with token refresh
npm run sync:full         # Full sync (all assignments)
npm run sync:incremental  # Only new assignments
npm run tokens            # Extract fresh tokens only
npm run manual            # Manual sync (no auto-refresh)
```

### Direct Commands
```bash
# Auto-sync (handles token expiry)
node auto-sync.mjs --full
node auto-sync.mjs --incremental

# Manual sync (basic)
node sync-assignments.mjs --full

# Token extraction
node token-stealer.mjs
```

### Advanced Filtering
```bash
# Only assigned and overdue
npm run sync -- --status=assigned --overdue

# Specific date range  
npm run sync -- --due-after=2025-09-01T00:00:00Z --due-before=2025-12-31T23:59:59Z

# Multiple statuses and classes
npm run sync -- --status=assigned --status=returned --class-id=uuid-here

# Incomplete assignments only
npm run sync -- --incomplete --due-before=2025-10-01T00:00:00Z
```

## 🔐 Token Management

### Automatic (Recommended)
The tool automatically opens a browser when tokens expire:
1. Logs you into Microsoft Teams
2. Waits for API calls to capture fresh tokens
3. Updates `.env` file automatically
4. Continues with sync

### Manual Setup
Create `.env` file:
```bash
AUI_URL="https://assignments.onenote.com/api/v1.0/edu/me/work?$top=100&$orderby=dueDateTime%20desc&$expand=submissions($expand=outcomes),categories,submissionAggregates"
AUI_TOKEN="your-bearer-token"
AUI_SESSION_ID="your-session-id"
```

## 📁 Output Files

### `assignments.json`
Complete normalized assignment data:
```json
{
  "id": "assignment-uuid",
  "title": "Assignment Name", 
  "teacherName": "Teacher Name",
  "teacherEmail": "teacher@school.edu",
  "studentCount": 25,
  "dueDate": "2025-09-20T08:00:00.000Z",
  "status": "assigned",
  "classId": "class-uuid",
  "allTurnedIn": false,
  "agg_total": 25,
  "agg_submitted": 12
}
```

### `assignments.xlsx`
Excel file with columns:
- id, title, classId, teacherName, teacherEmail, studentCount
- status, dueDate, assignedDate, createdDate, modifiedDate  
- allTurnedIn, anySubmittedState, allowLateSubmissions
- agg_total, agg_submitted, webUrl

### `notion_payload.json`
Ready for Notion API integration:
```json
{
  "external_id": "assignment-uuid",
  "properties": {
    "Title": "Assignment Name",
    "TeacherName": "Teacher Name", 
    "DueDate": "2025-09-20T08:00:00.000Z",
    "Status": "assigned"
  }
}
```

### `state.json`  
Tracks processed assignments for incremental sync:
```json
{
  "lastRun": "2025-09-16T02:18:55.185Z",
  "seenIds": ["id1", "id2", "..."]
}
```

## 🌐 Deployment Options

### Local Development
```bash
./run.sh --incremental
```

### VPS/Server
```bash
# Install dependencies
npm run setup

# Run via cron (daily at 6 AM)
0 6 * * * cd /path/to/AssignmentSync && npm run sync:incremental >> sync.log 2>&1
```

### GitHub Actions
Automatically configured in `.github/workflows/sync-assignments.yml`:
- Manual triggers via Actions tab
- Scheduled daily runs
- Secure token storage via repository secrets
- Automatic artifact uploads

**Setup Secrets:**
1. Go to Repository → Settings → Secrets and Variables → Actions
2. Add: `AUI_URL`, `AUI_TOKEN`, `AUI_SESSION_ID`

## 🔧 Configuration

### Filtering Options
- `--full` / `--incremental`: Sync mode
- `--status=assigned`: Filter by status (repeatable)
- `--class-id=uuid`: Filter by class (repeatable)
- `--due-before=ISO`: Due before date
- `--due-after=ISO`: Due after date  
- `--incomplete`: Not all turned in
- `--overdue`: Past due date

### Environment Variables
- `AUI_URL`: Full API endpoint with filters
- `AUI_TOKEN`: Bearer token (without "Bearer " prefix)
- `AUI_SESSION_ID`: Session ID for API calls

## 🛠️ Troubleshooting

### "Authorization failed"
- Tokens expire frequently (~1 hour)
- Run `npm run tokens` to refresh
- Or use `npm run sync` for auto-refresh

### "Could not fetch members for class"
- Some classes restrict member access
- Script continues with empty teacher info
- Normal behavior, not an error

### Browser automation issues
- Ensure you're logged into Teams in the automated browser
- Check your organization's browser policies
- Try running manually: `node token-stealer.mjs`

## 📊 Example Output

```bash
$ npm run sync:incremental

🚀 Microsoft Teams Assignment Sync
🔄 Running auto-sync with token refresh capability...
📝 Sync attempt 1/2
🚀 Running sync with args: --incremental
Fetching assignments from Microsoft Teams...
Normalizing assignments and fetching class details...

Summary:
- Total fetched from API: 244
- Total after filters: 12  
- Written to assignments.json: 12
- Written to assignments.xlsx: 12
- Written to notion_payload.json: 12
- New items (incremental): 12

Preview (first 10 items):
Due Date                  Title                                    Teacher                   Status     Students
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
2025-09-20T08:00:00.000Z  2-Kinetic Theory Calc in Phys Ex91 ...   Gray, Ian - IRG           assigned   12
2025-09-19T08:00:00.000Z  1-Gas Laws Calc in Physics Ex89 Q 1...   Gray, Ian - IRG           assigned   12

✅ Sync completed successfully!
🎉 Sync completed successfully!
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your Teams instance
5. Submit a pull request

## 📄 License

MIT License - feel free to use for personal or educational purposes.