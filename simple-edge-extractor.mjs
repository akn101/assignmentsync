#!/usr/bin/env node

/*
 * simple-edge-extractor.mjs - Simple Teams Token Extractor using Edge
 *
 * Just launches Edge, navigates to Teams, and waits for you to manually
 * navigate to assignments while monitoring all API calls.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';

console.log('🔧 Starting simple Edge token extractor...');

const tokens = {
  AUI_TOKEN: null,
  AUI_SESSION_ID: null,
  AUI_URL: null
};

let foundTokens = false;

// Strip any $filter query parameter (especially dueDateTime filters)
// so that downstream tools can control filtering themselves.
function sanitizeAuiUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('$filter')) {
      parsed.searchParams.delete('$filter');
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

// Load existing tokens from .env on startup
function loadExistingTokens() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        const cleanValue = value.replace(/"/g, '');
        if (key === 'AUI_TOKEN') tokens.AUI_TOKEN = cleanValue;
        if (key === 'AUI_SESSION_ID') tokens.AUI_SESSION_ID = cleanValue;
        if (key === 'AUI_URL') tokens.AUI_URL = cleanValue;
      }
    }

    if (tokens.AUI_TOKEN) {
      console.log('📂 Loaded existing tokens from .env');
      console.log(`   Token: ${tokens.AUI_TOKEN.substring(0, 30)}...`);
      console.log(`   Session: ${tokens.AUI_SESSION_ID}`);
    }
  } catch (error) {
    console.log('📄 No existing .env file found');
  }
}

// Save tokens immediately when found
function saveTokensImmediately() {
  console.log('💾 Saving tokens to .env immediately...');

  let envContent = '';
  try {
    envContent = fs.readFileSync('.env', 'utf8');
  } catch (error) {
    console.log('📄 Creating new .env file...');
  }

  const updates = [
    ['AUI_URL', sanitizeAuiUrl(tokens.AUI_URL)],
    ['AUI_TOKEN', tokens.AUI_TOKEN],
    ['AUI_SESSION_ID', tokens.AUI_SESSION_ID]
  ];

  for (const [key, value] of updates) {
    if (value) {
      const line = `${key}="${value}"`;
      if (envContent.includes(`${key}=`)) {
        const regex = new RegExp(`${key}=.*`, 'g');
        envContent = envContent.replace(regex, line);
      } else {
        envContent += `\n${line}`;
      }
    }
  }

  fs.writeFileSync('.env', envContent);
  console.log('✅ Tokens saved persistently to .env!');
}

async function main() {
  // Load any existing tokens first
  loadExistingTokens();

  const userDataDir = os.homedir() + '/Library/Application Support/Microsoft Edge/Profile 1';

  console.log('🚀 Launching Edge with school profile (Profile 1)...');

  // Launch Edge with persistent context using school profile
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'msedge',
    args: ['--remote-debugging-port=9222'],
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Set up network monitoring
  console.log('🕸️ Setting up network monitoring...');

  page.on('request', (request) => {
    const url = request.url();
    const headers = request.headers();

    // Show all requests (but filter out static assets for readability)
    if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.svg')) {
      console.log(`🌐 ${url}`);

      if (headers.authorization) {
        console.log(`   🔑 Has Auth header`);
      }
      if (headers['x-usersessionid']) {
        console.log(`   🆔 Has Session ID`);
      }
    }

    // Look for assignments API calls (prioritize the main assignments endpoint)
    if (url.includes('/api/v1.0/edu/me/work') ||
        url.includes('/api/v1.0/edu/classes') ||
        (url.includes('/api/v1.0/edu/') && headers.authorization)) {

      console.log(`📡 🎯 ASSIGNMENTS API: ${url}`);

      if (headers.authorization) {
        tokens.AUI_TOKEN = headers.authorization.replace('Bearer ', '');
        console.log(`🔑 TOKEN: ${tokens.AUI_TOKEN.substring(0, 30)}...`);
      }

      if (headers['x-usersessionid']) {
        tokens.AUI_SESSION_ID = headers['x-usersessionid'];
        console.log(`🆔 SESSION: ${tokens.AUI_SESSION_ID}`);
      }

      // Prioritize the main assignments endpoint for URL
      if (url.includes('/api/v1.0/edu/me/work') || !tokens.AUI_URL) {
        tokens.AUI_URL = url.split('&$skiptoken=')[0];
      }

      // Save tokens immediately when found
      if (tokens.AUI_TOKEN || tokens.AUI_SESSION_ID || tokens.AUI_URL) {
        saveTokensImmediately();
      }

      if (tokens.AUI_TOKEN && tokens.AUI_SESSION_ID) {
        foundTokens = true;
        console.log('✅ SUCCESS: Got all tokens!');
      }
    }
  });

  console.log('🧭 Navigating to Teams...');
  await page.goto('https://teams.microsoft.com/v2/');

  console.log('💡 Please complete login and profile selection...');
  console.log('⏳ Waiting for Teams to load, then will auto-click Assignments');

  // Wait for Teams to load and login to complete
  await page.waitForTimeout(15000); // 15 seconds for login/profile selection

  // Try to automatically click assignments
  console.log('🎯 Attempting to automatically click Assignments...');

  const assignmentSelectors = [
    'button[aria-label="Assignments"]',
    'button[aria-label*="Assignment"]',
    'a[href*="assignments"]',
    'button:has-text("Assignments")',
    '[data-tid*="assignment" i]',
    'button[title*="Assignment"]',
    // Teams specific selectors
    'div[data-app-name="assignments"] button',
    'button[data-app-id*="assignment"]',
    // More generic approaches
    'button:text("Assignments")',
    'a:text("Assignments")'
  ];

  let clickedAssignments = false;

  for (const selector of assignmentSelectors) {
    try {
      console.log(`🔍 Trying: ${selector}`);

      const element = await page.waitForSelector(selector, {
        timeout: 3000,
        state: 'visible'
      });

      if (element) {
        console.log('✅ Found assignments element, clicking...');
        await element.click();

        // Wait a bit for navigation/loading
        await page.waitForTimeout(3000);

        clickedAssignments = true;
        console.log('🎯 Successfully clicked Assignments!');
        break;
      }
    } catch (error) {
      console.log(`⚠️ ${selector} failed: ${error.message}`);
      continue;
    }
  }

  if (!clickedAssignments) {
    console.log('⚠️ Could not auto-click assignments');
    console.log('💡 Please manually click "Assignments" in Teams');
  }

  console.log('⏳ Monitoring for API calls... (Press Ctrl+C to stop)');

  // Keep running until tokens found or interrupted
  while (!foundTokens) {
    await page.waitForTimeout(1000);
  }

  // Update .env file
  console.log('📝 Updating .env file...');

  let envContent = '';
  try {
    envContent = fs.readFileSync('.env', 'utf8');
  } catch (error) {
    console.log('📄 Creating new .env file...');
  }

  const updates = [
    ['AUI_URL', tokens.AUI_URL],
    ['AUI_TOKEN', tokens.AUI_TOKEN],
    ['AUI_SESSION_ID', tokens.AUI_SESSION_ID]
  ];

  for (const [key, value] of updates) {
    if (value) {
      const line = `${key}="${value}"`;
      if (envContent.includes(`${key}=`)) {
        const regex = new RegExp(`${key}=.*`, 'g');
        envContent = envContent.replace(regex, line);
      } else {
        envContent += `\n${line}`;
      }
    }
  }

  fs.writeFileSync('.env', envContent);
  console.log('✅ Updated .env file with fresh tokens!');

  console.log('\n📋 Summary:');
  console.log(`   URL: ${tokens.AUI_URL?.split('?')[0]}...`);
  console.log(`   Token: ${tokens.AUI_TOKEN?.substring(0, 30)}...`);
  console.log(`   Session: ${tokens.AUI_SESSION_ID}`);

  await context.close();
  console.log('🎉 Done!');
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted by user');
  process.exit(0);
});

main().catch(console.error);
