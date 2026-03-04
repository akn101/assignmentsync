#!/usr/bin/env node
/**
 * refresh-token.mjs
 * Exchanges AUI_REFRESH_TOKEN for a fresh AUI_TOKEN via Microsoft OAuth.
 *
 * Local: updates .env file
 * CI:    writes "KEY=value" lines to stdout for `>> $GITHUB_ENV`
 */

import fs from 'fs';

const TENANT_ID = 'c6efde5c-812f-4728-8f72-dbc1a1407500';
const CLIENT_ID = 'ccb65bcd-04ba-421a-8791-a299a70904b6';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const SCOPES = 'EduAssignments.Read EduAssignments.ReadWrite EduCurricula.Read EduCurricula.ReadWrite offline_access';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Load .env locally so AUI_REFRESH_TOKEN is available without manual export
if (!isCi) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)="?([^"]*)"?$/);
      if (match) process.env[match[1].trim()] ??= match[2].trim();
    }
  } catch {}
}

async function main() {
  const refreshToken = process.env.AUI_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('❌ AUI_REFRESH_TOKEN not set. Run npm run extract-tokens to capture one.');
    process.exit(1);
  }

  console.error('🔄 Refreshing access token...');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      scope: SCOPES,
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('❌ Token refresh failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.error('✅ Access token refreshed successfully');

  const updates = [
    ['AUI_TOKEN', data.access_token],
    ...(data.refresh_token ? [['AUI_REFRESH_TOKEN', data.refresh_token]] : []),
  ];

  if (isCi) {
    // Write to GITHUB_ENV format — caller does: node refresh-token.mjs >> $GITHUB_ENV
    for (const [key, value] of updates) {
      process.stdout.write(`${key}=${value}\n`);
    }
  } else {
    // Update .env file
    let envContent = '';
    try { envContent = fs.readFileSync('.env', 'utf8'); } catch {}

    for (const [key, value] of updates) {
      const line = `${key}="${value}"`;
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), line);
      } else {
        envContent += `\n${line}`;
      }
    }

    fs.writeFileSync('.env', envContent);
    console.error('💾 Updated .env with fresh tokens');
  }
}

main();
