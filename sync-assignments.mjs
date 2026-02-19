#!/usr/bin/env node

/*
 * sync-assignments.mjs - Microsoft Teams Assignments Sync CLI
 * 
 * Quick Start:
 * 1. npm install xlsx
 * 2. export AUI_URL='https://assignments.onenote.com/api/v1.0/assignments?$filter=...'
 * 3. export AUI_TOKEN='your-bearer-token-without-bearer-prefix'
 * 4. node sync-assignments.mjs [flags]
 *
 * Examples:
 * - node sync-assignments.mjs
 * - node sync-assignments.mjs --status=assigned --incomplete --due-before=2025-12-31T23:59:59Z --incremental
 * - node sync-assignments.mjs --class-id=uuid --overdue --full
 */

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Load environment variables from .env file
function loadEnv(override = false) {
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2].replace(/^"|"$/g, '');
        if (override || !process.env[key]) { // Allow override when requested
          process.env[key] = value;
        }
      }
    });
  }
}

// Load .env on startup
loadEnv();

class AssignmentSync {
  constructor() {
    this.args = this.parseArgs();
    this.state = this.loadState();
    this.classMembers = new Map(); // Cache for class members
  }

  parseArgs() {
    const args = {
      dueBefore: null,
      dueAfter: null,
      statuses: [],
      classIds: [],
      incomplete: false,
      overdue: false,
      incremental: false,
      full: false,
      details: null, // Format: "classId:assignmentId"
      refreshTokens: false // Auto-refresh tokens before sync
    };

    const argv = process.argv.slice(2);
    
    // Check for help flag first
    if (argv.includes('--help') || argv.includes('-h')) {
      this.printHelp();
      process.exit(0);
    }
    
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      
      if (arg.startsWith('--due-before=')) {
        args.dueBefore = arg.split('=')[1];
      } else if (arg.startsWith('--due-after=')) {
        args.dueAfter = arg.split('=')[1];
      } else if (arg.startsWith('--status=')) {
        args.statuses.push(arg.split('=')[1]);
      } else if (arg.startsWith('--class-id=')) {
        args.classIds.push(arg.split('=')[1]);
      } else if (arg === '--incomplete') {
        args.incomplete = true;
      } else if (arg === '--overdue') {
        args.overdue = true;
      } else if (arg === '--incremental') {
        args.incremental = true;
      } else if (arg === '--full') {
        args.full = true;
      } else if (arg.startsWith('--details=')) {
        args.details = arg.split('=')[1];
      } else if (arg === '--refresh-tokens') {
        args.refreshTokens = true;
      }
    }

    // Default to full if neither incremental nor full is specified
    if (!args.incremental && !args.full) {
      args.full = true;
    }

    // Validate date filters
    if (args.dueBefore && !this.parseIsoOrNull(args.dueBefore)) {
      console.error(`Invalid --due-before date: ${args.dueBefore}`);
      process.exit(1);
    }
    if (args.dueAfter && !this.parseIsoOrNull(args.dueAfter)) {
      console.error(`Invalid --due-after date: ${args.dueAfter}`);
      process.exit(1);
    }

    return args;
  }

  parseIsoOrNull(s) {
    if (!s) return null;
    try {
      const date = new Date(s);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  iso(s) {
    if (!s) return '';
    const date = this.parseIsoOrNull(s);
    return date ? date.toISOString() : '';
  }

  trim(s, n) {
    if (!s) return '';
    return s.length > n ? s.substring(0, n - 3) + '...' : s;
  }

  loadState() {
    try {
      const stateData = fs.readFileSync('state.json', 'utf8');
      return JSON.parse(stateData);
    } catch {
      return {
        lastRun: null,
        seenIds: []
      };
    }
  }

  saveState() {
    fs.writeFileSync('state.json', JSON.stringify(this.state, null, 2));
  }

  generateCorrelationId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  formatTeacherName(name) {
    if (!name) return '';

    // Handle format "Last, First - CODE" -> "First Last - CODE"
    const match = name.match(/^(.+?),\s*(.+?)\s*-\s*(.+)$/);
    if (match) {
      const [, lastName, firstName, code] = match;
      return `${firstName.trim()} ${lastName.trim()} - ${code.trim()}`;
    }

    // If no match, just replace comma with space to avoid double dashes
    return name.replace(/,/g, ' ');
  }

  printHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   AssignmentSync - Microsoft Teams Assignment Sync CLI     ║
╚════════════════════════════════════════════════════════════╝

USAGE:
  node sync-assignments.mjs [FLAGS]

FLAGS:
  --help, -h                Show this help message
  --full                    Sync all assignments (default)
  --incremental             Only sync new assignments
  --refresh-tokens          Refresh tokens before syncing
  --status=<status>         Filter by status (can use multiple times)
  --class-id=<uuid>         Filter by classroom ID (can use multiple times)
  --due-before=<ISO-DATE>   Only assignments due before this date
  --due-after=<ISO-DATE>    Only assignments due after this date
  --incomplete              Only incomplete assignments
  --overdue                 Only overdue assignments
  --details=<classId>:<assignmentId>  Show detailed info for one assignment

EXAMPLES:
  # Sync all assignments
  npm run sync

  # Only sync incomplete assignments
  node sync-assignments.mjs --incomplete

  # Sync with a date filter
  node sync-assignments.mjs --due-before=2025-12-31T23:59:59Z

  # Combine multiple filters
  node sync-assignments.mjs --incomplete --overdue --incremental

  # Get details for a specific assignment
  node sync-assignments.mjs --details=class-uuid:assignment-uuid

ENVIRONMENT:
  .env file should contain:
    AUI_TOKEN=<bearer-token>
    AUI_SESSION_ID=<session-id>
    AUI_URL=https://assignments.onenote.com/api/v1.0/assignments

  Setup tokens automatically:
    npm run setup
    npm run extract-tokens

OUTPUT:
  Generated files in outputs/:
    - assignments.json, assignments.csv, assignments.xlsx
    - by-year/YYYY/assignments.*
    - by-month/YYYY/MM/assignments.*
    - notion_payload.json (for Notion upload)
    - state.json (tracks processed assignments)

For more info, see README.md
`);
  }

  validateToken(token) {
    if (!token) return false;

    try {
      // Basic JWT validation - should have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Decode the payload to check expiry
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp > now) {
        const expiryDate = new Date(payload.exp * 1000);
        const timeLeft = Math.round((payload.exp - now) / 60);
        console.log(`🕒 Token expires in ${timeLeft} minutes (${expiryDate.toLocaleString()})`);
        return true;
      }

      console.warn('⚠️  Token appears to be expired');
      return false;
    } catch (error) {
      console.warn('⚠️  Could not validate token:', error.message);
      return false;
    }
  }

  async refreshTokensIfNeeded() {
    const token = process.env.AUI_TOKEN;

    if (!token || !this.validateToken(token)) {
      console.log('🔄 Token is missing or expired, attempting to refresh...');

      try {
        // Launch simple-edge-extractor.mjs as a subprocess
        const { spawn } = await import('child_process');

        console.log('🚀 Launching Edge token extractor...');

        const extractorProcess = spawn('node', ['simple-edge-extractor.mjs'], {
          stdio: 'inherit',
          cwd: process.cwd()
        });

        await new Promise((resolve, reject) => {
          extractorProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Token extractor exited with code ${code}`));
            }
          });

          extractorProcess.on('error', reject);
        });

        // Reload environment variables from .env file, overriding existing values
        loadEnv(true);

        // Validate the refreshed token
        if (this.validateToken(process.env.AUI_TOKEN)) {
          console.log('✅ Tokens refreshed successfully');
          return true;
        } else {
          console.error('❌ Token refresh failed - invalid token after extraction');
          return false;
        }
      } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        return false;
      }
    }

    console.log('✅ Token is valid');
    return true;
  }

  async fetchWithAuth(url, allowFailure = false) {
    const token = process.env.AUI_TOKEN;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
          'Referer': 'https://assignments.onenote.com/',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Priority': 'u=3, i',
          'x-aui-version': 'aui.v20250908.5',
          'MS-Int-AppID': 'assignments-ui',
          'x-correlationid': this.generateCorrelationId(),
          'x-aui-app': 'assignments',
          'x-teams-ring': 'general',
          'x-usersessionid': process.env.AUI_SESSION_ID || this.generateCorrelationId(),
          'X-MS-IsWeekView': 'undefined',
          'x-rh': '1'
        }
      });

      if (response.status === 401 || response.status === 403) {
        if (allowFailure) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        console.error('Authorization failed (likely expired token). Recapture a fresh Bearer token.');
        process.exit(1);
      }

      if (response.status !== 200) {
        if (allowFailure) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const body = await response.text();
        console.error(`HTTP ${response.status}: ${body.substring(0, 2000)}`);
        process.exit(1);
      }

      return await response.json();
    } catch (error) {
      if (allowFailure) {
        throw error;
      }
      console.error(`Fetch error: ${error.message}`);
      process.exit(1);
    }
  }

  async fetchClassMembers(classId) {
    if (this.classMembers.has(classId)) {
      return this.classMembers.get(classId);
    }

    const membersUrl = `https://assignments.onenote.com/api/v1.0/edu/classes/${classId}/members?\$orderBy=displayName%20asc`;
    
    try {
      const data = await this.fetchWithAuth(membersUrl, true);
      
      const members = {
        teachers: [],
        students: [],
        byId: new Map()
      };

      if (data.value && Array.isArray(data.value)) {
        data.value.forEach(member => {
          const person = {
            id: member.id,
            displayName: member.displayName,
            email: member.email,
            role: member.role
          };
          
          members.byId.set(member.id, person);
          
          if (member.role === 'teacher') {
            members.teachers.push(person);
          } else if (member.role === 'student') {
            members.students.push(person);
          }
        });
      }

      this.classMembers.set(classId, members);
      return members;
      
    } catch (error) {
      console.warn(`Could not fetch members for class ${classId}: ${error.message}`);
      
      // Return empty members object if we can't fetch
      const emptyMembers = {
        teachers: [],
        students: [],
        byId: new Map()
      };
      
      this.classMembers.set(classId, emptyMembers);
      return emptyMembers;
    }
  }

  async fetchAssignmentDetails(classId, assignmentId) {
    const token = process.env.AUI_TOKEN;
    const sessionId = process.env.AUI_SESSION_ID;

    if (!token) {
      throw new Error('AUI_TOKEN environment variable is required');
    }

    const url = `https://assignments.onenote.com/api/v1.0/edu/classes('${classId}')/assignments('${assignmentId}')?$expand=rubric(),resources(dependentResources()),postSubmitOperations(),gradingCategory(),submissionAggregates(),gradingScheme()`;

    console.log(`🔍 Fetching assignment details for ${assignmentId}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'x-rh': '1',
        'x-correlationid': this.generateCorrelationId(),
        'x-usersessionid': sessionId || this.generateCorrelationId(),
        'x-aui-version': 'aui.v20250908.5',
        'MS-Int-AppID': 'assignments-ui',
        'x-aui-app': 'assignments',
        'x-teams-ring': 'general'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authorization failed (likely expired token). Recapture a fresh Bearer token.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const assignment = await response.json();
    console.log(`✅ Fetched assignment: "${assignment.displayName}"`);
    console.log(`📝 Description: ${assignment.instructions?.content ? assignment.instructions.content.replace(/<[^>]*>/g, '') : 'No description'}`);
    console.log(`📅 Due: ${assignment.dueDateTime}`);
    console.log(`👥 Status: ${assignment.status}, All turned in: ${assignment.allTurnedIn}`);

    return assignment;
  }

  async fetchAllAssignments() {
    let url = process.env.AUI_URL;

    if (!url) {
      console.error('AUI_URL environment variable is required');
      process.exit(1);
    }
    if (!process.env.AUI_TOKEN) {
      console.error('AUI_TOKEN environment variable is required');
      process.exit(1);
    }

    // Ensure we control the date filter: start from the beginning of the current month.
    try {
      const parsed = new URL(url);

      // Compute start of current month in UTC
      const now = new Date();
      const monthStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1, 0, 0, 0, 0
      ));

      // Replace any existing $filter with our own month-based filter
      parsed.searchParams.delete('$filter');
      parsed.searchParams.set('$filter', `dueDateTime ge ${monthStart.toISOString()}`);

      console.log(`📅 Applying API date filter from start of month: dueDateTime ge ${monthStart.toISOString()}`);

      url = parsed.toString();
    } catch {
      // If URL parsing fails, just fall back to the original string
    }

    let allItems = [];
    let nextUrl = url;

    while (nextUrl) {
      const data = await this.fetchWithAuth(nextUrl);
      
      if (data.value && Array.isArray(data.value)) {
        allItems.push(...data.value);
      }

      nextUrl = data['@odata.nextLink'] || null;
    }

    return allItems;
  }

  async fetchDetailedAssignment(classId, assignmentId) {
    const detailUrl = `https://assignments.onenote.com/api/v1.0/edu/classes/${classId}/assignments/${assignmentId}?\$expand=rubric,resources(\$expand=dependentResources),postSubmitOperations,gradingCategory,submissionAggregates,gradingScheme`;

    try {
      const response = await fetch(detailUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.AUI_TOKEN}`,
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
          'Referer': 'https://assignments.onenote.com/',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Priority': 'u=3, i',
          'x-aui-version': 'aui.v20250908.5',
          'MS-Int-AppID': 'assignments-ui',
          'x-correlationid': this.generateCorrelationId(),
          'x-aui-app': 'assignments',
          'x-teams-ring': 'general',
          'x-usersessionid': process.env.AUI_SESSION_ID || this.generateCorrelationId(),
          'x-rh': '1',
          'Prefer': 'AssignmentStatusV2'
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn(`Could not fetch detailed assignment ${assignmentId}: ${error.message}`);
    }

    return null;
  }

  async normalizeAssignment(raw) {
    const submissionAggregates = raw.submissionAggregates || {};
    const classId = String(raw.classId || '');

    // Use teacher data exactly as provided by the API

    // Fetch class members to get teacher info
    let teacherName = '';
    let teacherEmail = '';
    let studentCount = 0;

    try {
      if (classId) {
        const members = await this.fetchClassMembers(classId);

        // Try to find teacher by createdBy user ID first
        const createdByUserId = raw.createdBy?.user?.id;
        if (createdByUserId && members.byId.has(createdByUserId)) {
          const creator = members.byId.get(createdByUserId);
          if (creator.role === 'teacher') {
            teacherName = creator.displayName || '';
            teacherEmail = creator.email || '';
          }
        }

        // Fallback to first teacher if createdBy lookup failed
        if (!teacherName && members.teachers.length > 0) {
          teacherName = members.teachers[0].displayName || '';
          teacherEmail = members.teachers[0].email || '';
        }

        studentCount = members.students.length;
      }
    } catch (error) {
      console.warn(`Could not fetch class members for ${classId}: ${error.message}`);
    }

    // Extract description from instructions
    let description = '';
    if (raw.instructions && raw.instructions.content) {
      description = raw.instructions.content.replace(/<[^>]*>/g, '').trim();
    }

    // If description is missing or insufficient, try to fetch detailed assignment
    if (!description && classId && raw.id) {
      try {
        console.log(`📝 Fetching detailed instructions for assignment: ${raw.displayName}`);
        const detailedAssignment = await this.fetchDetailedAssignment(classId, raw.id);
        if (detailedAssignment && detailedAssignment.instructions && detailedAssignment.instructions.content) {
          description = detailedAssignment.instructions.content.replace(/<[^>]*>/g, '').trim();
        }
      } catch (error) {
        console.warn(`Could not fetch detailed assignment ${raw.id}: ${error.message}`);
      }
    }

    return {
      id: String(raw.id || ''),
      title: String(raw.displayName || ''),
      description: description,
      dueDate: this.iso(raw.dueDateTime),
      assignedDate: this.iso(raw.assignedDateTime),
      createdDate: this.iso(raw.createdDateTime),
      modifiedDate: this.iso(raw.lastModifiedDateTime),
      status: String(raw.status || ''),
      classId: classId,
      teacherName: teacherName,
      teacherEmail: teacherEmail,
      studentCount: studentCount,
      webUrl: String(raw.webUrl || ''),
      allTurnedIn: Boolean(raw.allTurnedIn),
      anySubmittedState: Boolean(raw.anySubmittedState),
      allowLateSubmissions: Boolean(raw.allowLateSubmissions),
      agg_total: Number(submissionAggregates.total || 0),
      agg_submitted: Number(submissionAggregates.submitted || 0)
    };
  }

  applyFilters(items) {
    return items.filter(item => {
      // Due date filters
      if (this.args.dueBefore && item.dueDate) {
        const dueDate = this.parseIsoOrNull(item.dueDate);
        const beforeDate = this.parseIsoOrNull(this.args.dueBefore);
        if (dueDate && beforeDate && dueDate > beforeDate) {
          return false;
        }
      }

      if (this.args.dueAfter && item.dueDate) {
        const dueDate = this.parseIsoOrNull(item.dueDate);
        const afterDate = this.parseIsoOrNull(this.args.dueAfter);
        if (dueDate && afterDate && dueDate < afterDate) {
          return false;
        }
      }

      // Status filter
      if (this.args.statuses.length > 0 && !this.args.statuses.includes(item.status)) {
        return false;
      }

      // Class ID filter
      if (this.args.classIds.length > 0 && !this.args.classIds.includes(item.classId)) {
        return false;
      }

      // Incomplete filter
      if (this.args.incomplete && (item.allTurnedIn && item.anySubmittedState)) {
        return false;
      }

      // Overdue filter
      if (this.args.overdue) {
        if (!item.dueDate) return false;
        const dueDate = this.parseIsoOrNull(item.dueDate);
        const now = new Date();
        if (!dueDate || dueDate >= now) {
          return false;
        }
      }

      // Incremental filter
      if (this.args.incremental && this.state.seenIds.includes(item.id)) {
        return false;
      }

      return true;
    });
  }

  writeJsonFile(items) {
    // Create outputs directory if it doesn't exist
    if (!fs.existsSync('outputs')) {
      fs.mkdirSync('outputs', { recursive: true });
    }

    // Write main JSON file
    fs.writeFileSync('outputs/assignments.json', JSON.stringify(items, null, 2));

    // Write organized by year and month
    this.writeOrganizedFiles(items, 'json');
  }

  writeOrganizedFiles(items, format) {
    const byYear = new Map();
    const byMonth = new Map();
    
    items.forEach(item => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (!dueDate || isNaN(dueDate.getTime())) return;
      
      const year = dueDate.getFullYear();
      const month = dueDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase(); // "sep", "oct"
      const monthKey = `${year}/${month}`;
      
      // Group by year
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(item);
      
      // Group by month
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey).push(item);
    });
    
    // Write year files
    byYear.forEach((yearItems, year) => {
      const yearDir = `outputs/by-year/${year}`;
      if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true });
      }

      if (format === 'json') {
        fs.writeFileSync(`${yearDir}/assignments.json`, JSON.stringify(yearItems, null, 2));
      } else if (format === 'csv') {
        this.writeCsvFile(yearItems, `${yearDir}/assignments.csv`);
      }
    });

    // Write month files
    byMonth.forEach((monthItems, monthKey) => {
      const monthDir = `outputs/by-month/${monthKey}`;
      if (!fs.existsSync(monthDir)) {
        fs.mkdirSync(monthDir, { recursive: true });
      }

      if (format === 'json') {
        fs.writeFileSync(`${monthDir}/assignments.json`, JSON.stringify(monthItems, null, 2));
      } else if (format === 'csv') {
        this.writeCsvFile(monthItems, `${monthDir}/assignments.csv`);
      }
    });
  }

  writeCsvFile(items, filepath) {
    const headers = [
      'id', 'title', 'classId', 'teacherName', 'teacherEmail', 'studentCount',
      'status', 'dueDate', 'assignedDate', 'createdDate', 'modifiedDate', 
      'allTurnedIn', 'anySubmittedState', 'allowLateSubmissions', 
      'agg_total', 'agg_submitted', 'webUrl'
    ];

    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        `"${item.id}"`,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.classId}"`,
        `"${item.teacherName.replace(/"/g, '""')}"`,
        `"${item.teacherEmail}"`,
        item.studentCount,
        `"${item.status}"`,
        `"${item.dueDate}"`,
        `"${item.assignedDate}"`,
        `"${item.createdDate}"`,
        `"${item.modifiedDate}"`,
        item.allTurnedIn ? 'TRUE' : 'FALSE',
        item.anySubmittedState ? 'TRUE' : 'FALSE',
        item.allowLateSubmissions ? 'TRUE' : 'FALSE',
        item.agg_total,
        item.agg_submitted,
        `"${item.webUrl}"`
      ].join(','))
    ].join('\n');

    fs.writeFileSync(filepath, csvContent);
  }

  writeXlsxFile(items) {
    const headers = [
      'id', 'title', 'classId', 'teacherName', 'teacherEmail', 'studentCount',
      'status', 'dueDate', 'assignedDate', 'createdDate', 'modifiedDate', 
      'allTurnedIn', 'anySubmittedState', 'allowLateSubmissions', 
      'agg_total', 'agg_submitted', 'webUrl'
    ];

    const rows = [headers];
    
    items.forEach(item => {
      rows.push([
        item.id,
        item.title,
        item.classId,
        item.teacherName,
        item.teacherEmail,
        item.studentCount,
        item.status,
        item.dueDate,
        item.assignedDate,
        item.createdDate,
        item.modifiedDate,
        item.allTurnedIn ? 'TRUE' : 'FALSE',
        item.anySubmittedState ? 'TRUE' : 'FALSE',
        item.allowLateSubmissions ? 'TRUE' : 'FALSE',
        item.agg_total,
        item.agg_submitted,
        item.webUrl
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    
    // Create outputs directory if it doesn't exist
    if (!fs.existsSync('outputs')) {
      fs.mkdirSync('outputs', { recursive: true });
    }

    XLSX.writeFile(wb, 'outputs/assignments.xlsx');

    // Write main CSV file too
    this.writeCsvFile(items, 'outputs/assignments.csv');

    // Write organized CSV files
    this.writeOrganizedFiles(items, 'csv');
  }

  writeNotionPayload(items) {
    const payload = items.map(item => {
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        return {
          start: new Date(dateStr).toISOString()
        };
      };

      return {
        external_id: item.id,
        properties: {
          "Title": {
            "title": [{
              "text": { "content": item.title || "" }
            }]
          },
          "Assignment ID": {
            "rich_text": [{
              "text": { "content": item.id || "" }
            }]
          },
          "Notes": {
            "rich_text": [{
              "text": { "content": (item.description || "").substring(0, 2000) }
            }]
          },
          "Status": {
            "select": { "name": item.status || "" }
          },
          "allTurnedIn": {
            "select": { "name": item.allTurnedIn ? "true" : "false" }
          },
          "allowLateSubmissions": {
            "select": { "name": item.allowLateSubmissions ? "true" : "false" }
          },
          "anySubmittedState": {
            "select": { "name": item.anySubmittedState ? "true" : "false" }
          },
          "teacherEmail": {
            "email": item.teacherEmail || null
          },
          "teacherName": {
            "multi_select": item.teacherName ? [{ "name": this.formatTeacherName(item.teacherName) }] : []
          },
          "classId": {
            "rich_text": [{
              "text": { "content": item.classId || "" }
            }]
          },
          "classCode": {
            "rich_text": [{
              "text": { "content": "" }
            }]
          },
          "webUrl": {
            "url": item.webUrl || null
          },
          "studentCount": {
            "number": item.studentCount || 0
          },
          "agg_total": {
            "number": item.agg_total || 0
          },
          "agg_submitted": {
            "number": item.agg_submitted || 0
          },
          "assignedDate": {
            "date": formatDate(item.assignedDate)
          },
          "createdDate": {
            "date": formatDate(item.createdDate)
          },
          "dueDate": {
            "date": formatDate(item.dueDate)
          },
          "modifiedDate": {
            "date": formatDate(item.modifiedDate)
          }
        }
      };
    });

    // Create outputs directory if it doesn't exist
    if (!fs.existsSync('outputs')) {
      fs.mkdirSync('outputs', { recursive: true });
    }

    fs.writeFileSync('outputs/notion_payload.json', JSON.stringify(payload, null, 2));
  }

  async uploadToNotion(items) {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      console.log('⚠️  Notion upload skipped: Missing NOTION_TOKEN or NOTION_DATABASE_ID in .env');
      return;
    }

    console.log('📤 Checking for existing assignments in Notion...');

    // Get existing assignments to avoid duplicates
    const existingIds = await this.getExistingNotionIds();
    const newItems = items.filter(item => !existingIds.has(item.id));

    if (newItems.length === 0) {
      console.log('✅ All assignments already exist in Notion');
      return;
    }

    console.log(`📤 Uploading ${newItems.length} new assignments to Notion...`);

    const rateLimiter = this.createRateLimiter(300); // 3 requests per second
    let uploaded = 0;
    let failed = 0;

    for (const item of newItems) {
      await rateLimiter();
      try {
        await this.createNotionPage(item);
        uploaded++;
        if (uploaded % 10 === 0) {
          console.log(`📤 Uploaded ${uploaded}/${newItems.length} assignments...`);
        }
      } catch (error) {
        console.error(`❌ Failed to upload assignment ${item.id}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ Notion upload complete: ${uploaded} uploaded, ${failed} failed`);
  }

  async getExistingNotionIds() {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const existingIds = new Set();
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      try {
        const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            start_cursor: startCursor,
            page_size: 100
          })
        });

        if (!response.ok) {
          throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        data.results.forEach(page => {
          const assignmentId = page.properties['Assignment ID']?.rich_text?.[0]?.text?.content;
          if (assignmentId) {
            existingIds.add(assignmentId);
          }
        });

        hasMore = data.has_more;
        startCursor = data.next_cursor;
      } catch (error) {
        console.error('❌ Error fetching existing Notion entries:', error.message);
        break;
      }
    }

    console.log(`📋 Found ${existingIds.size} existing assignments in Notion`);
    return existingIds;
  }

  async createNotionPage(item) {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      return {
        start: new Date(dateStr).toISOString()
      };
    };

    const payload = {
      parent: {
        database_id: NOTION_DATABASE_ID
      },
      properties: {
        "Title": {
          "title": [{
            "text": { "content": item.title || "" }
          }]
        },
        "Assignment ID": {
          "rich_text": [{
            "text": { "content": item.id || "" }
          }]
        },
        "Notes": {
          "rich_text": [{
            "text": { "content": (item.description || "").substring(0, 2000) }
          }]
        },
        "Status": {
          "select": { "name": item.status || "" }
        },
        "allTurnedIn": {
          "select": { "name": item.allTurnedIn ? "true" : "false" }
        },
        "allowLateSubmissions": {
          "select": { "name": item.allowLateSubmissions ? "true" : "false" }
        },
        "anySubmittedState": {
          "select": { "name": item.anySubmittedState ? "true" : "false" }
        },
        "teacherEmail": {
          "email": item.teacherEmail || null
        },
        "teacherName": {
          "multi_select": item.teacherName ? [{ "name": this.formatTeacherName(item.teacherName) }] : []
        },
        "classId": {
          "rich_text": [{
            "text": { "content": item.classId || "" }
          }]
        },
        "webUrl": {
          "url": item.webUrl || null
        },
        "studentCount": {
          "number": item.studentCount || 0
        },
        "agg_total": {
          "number": item.agg_total || 0
        },
        "agg_submitted": {
          "number": item.agg_submitted || 0
        },
        "assignedDate": {
          "date": formatDate(item.assignedDate)
        },
        "createdDate": {
          "date": formatDate(item.createdDate)
        },
        "dueDate": {
          "date": formatDate(item.dueDate)
        },
        "modifiedDate": {
          "date": formatDate(item.modifiedDate)
        }
      }
    };

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`${response.status}: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  }

  createRateLimiter(delayMs) {
    let lastCall = 0;
    return async () => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      if (timeSinceLastCall < delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs - timeSinceLastCall));
      }
      lastCall = Date.now();
    };
  }

  updateState(processedIds) {
    if (this.args.full) {
      this.state.seenIds = processedIds;
    } else if (this.args.incremental) {
      const newIds = processedIds.filter(id => !this.state.seenIds.includes(id));
      this.state.seenIds.push(...newIds);
    }
    
    this.state.lastRun = new Date().toISOString();
    this.saveState();
  }

  printSummary(totalFetched, filteredItems, newCount = null) {
    // Count files by year/month for summary
    const yearCounts = new Map();
    const monthCounts = new Map();
    
    filteredItems.forEach(item => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (!dueDate || isNaN(dueDate.getTime())) return;
      
      const year = dueDate.getFullYear();
      const month = dueDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
      const monthKey = `${year}/${month}`;
      
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
    });

    console.log(`\nSummary:`);
    console.log(`- Total fetched from API: ${totalFetched}`);
    console.log(`- Total after filters: ${filteredItems.length}`);
    console.log(`- Written to outputs/assignments.json: ${filteredItems.length}`);
    console.log(`- Written to outputs/assignments.csv: ${filteredItems.length}`);
    console.log(`- Written to outputs/assignments.xlsx: ${filteredItems.length}`);
    console.log(`- Written to outputs/notion_payload.json: ${filteredItems.length}`);
    
    if (this.args.incremental && newCount !== null) {
      console.log(`- New items (incremental): ${newCount}`);
    }

    console.log(`\nOrganized Files:`);
    console.log(`- Year folders: ${yearCounts.size} (${Array.from(yearCounts.keys()).join(', ')})`);
    console.log(`- Month folders: ${monthCounts.size}`);

    // Show breakdown by year
    yearCounts.forEach((count, year) => {
      console.log(`  └─ outputs/by-year/${year}/: ${count} assignments`);
    });

    if (filteredItems.length > 0) {
      console.log(`\nPreview (first 10 items):`);
      console.log(`${'Due Date'.padEnd(25)} ${'Title'.padEnd(40)} ${'Teacher'.padEnd(25)} ${'Status'.padEnd(10)} Students`);
      console.log('─'.repeat(120));
      
      filteredItems.slice(0, 10).forEach(item => {
        const dueDate = item.dueDate || 'N/A';
        const title = this.trim(item.title, 38);
        const teacher = this.trim(item.teacherName, 23);
        const status = item.status;
        const students = item.studentCount;
        
        console.log(`${dueDate.padEnd(25)} ${title.padEnd(40)} ${teacher.padEnd(25)} ${status.padEnd(10)} ${students}`);
      });
    }
  }

  async run() {
    try {
      // Auto-refresh locally unless disabled; avoid launching browsers in CI.
      const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
      const autoRefreshDisabled = process.env.AUI_AUTO_REFRESH === '0';
      const shouldAutoRefresh = this.args.refreshTokens || (!isCi && !autoRefreshDisabled);

      if (shouldAutoRefresh) {
        const refreshed = await this.refreshTokensIfNeeded();
        if (!refreshed) {
          console.error('❌ Token refresh failed. Please provide valid tokens manually.');
          process.exit(1);
        }
      } else {
        // Always validate tokens before proceeding
        if (!this.validateToken(process.env.AUI_TOKEN)) {
          console.error('❌ Invalid or expired token. Use --refresh-tokens to auto-refresh or update .env manually.');
          process.exit(1);
        }
      }

      // Handle assignment details request
      if (this.args.details) {
        const [classId, assignmentId] = this.args.details.split(':');
        if (!classId || !assignmentId) {
          console.error('❌ Invalid details format. Use: --details=classId:assignmentId');
          process.exit(1);
        }

        const assignment = await this.fetchAssignmentDetails(classId, assignmentId);

        // Save detailed assignment info to file
        const filename = `assignment-${assignmentId}-details.json`;
        fs.writeFileSync(filename, JSON.stringify(assignment, null, 2));
        console.log(`💾 Detailed assignment info saved to ${filename}`);

        return;
      }

      console.log('Fetching assignments from Microsoft Teams...');
      
      const rawAssignments = await this.fetchAllAssignments();
      
      console.log('Normalizing assignments and fetching class details...');
      const normalizedAssignments = [];
      for (const raw of rawAssignments) {
        const normalized = await this.normalizeAssignment(raw);
        normalizedAssignments.push(normalized);
      }
      const filteredAssignments = this.applyFilters(normalizedAssignments);
      
      const newCount = this.args.incremental ? 
        filteredAssignments.filter(item => !this.state.seenIds.includes(item.id)).length : 
        null;

      this.writeJsonFile(filteredAssignments);
      this.writeXlsxFile(filteredAssignments);
      this.writeNotionPayload(filteredAssignments);

      // Upload to Notion if configured
      await this.uploadToNotion(filteredAssignments);

      const processedIds = filteredAssignments.map(item => item.id);
      this.updateState(processedIds);
      
      this.printSummary(rawAssignments.length, filteredAssignments, newCount);
      
      console.log('\n✅ Sync completed successfully!');
      process.exit(0);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}

const sync = new AssignmentSync();
sync.run();
