#!/usr/bin/env node

/*
 * edge-token-extractor.mjs - Teams Token Extractor using Microsoft Edge
 *
 * Uses Playwright with Microsoft Edge to access Teams web interface,
 * automatically click assignments, and extract API tokens from network requests.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

class EdgeTokenExtractor {
  constructor() {
    this.tokens = {
      AUI_TOKEN: null,
      AUI_SESSION_ID: null,
      AUI_URL: null
    };
    this.requestCount = 0;
    this.foundTokens = false;
    this.browser = null;
    this.page = null;
  }

  async launchEdgeWithProfile() {
    console.log('🚀 Launching Microsoft Edge with existing profile...');

    const userDataDir = os.homedir() + '/Library/Application Support/Microsoft Edge';

    // Launch Edge with persistent context (actual user profile)
    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'msedge',
        args: [
          '--remote-debugging-port=9222',
          '--disable-web-security'
        ],
        viewport: { width: 1280, height: 720 }
      });

      this.browser = context.browser();
      this.page = await context.newPage();
      console.log('✅ Edge launched successfully with persistent profile');

    } catch (error) {
      console.log('⚠️ Failed to launch with persistent context, trying regular launch...');

      // Fallback to regular launch
      this.browser = await chromium.launch({
        headless: false,
        channel: 'msedge',
        args: ['--remote-debugging-port=9222']
      });

      const context = await this.browser.newContext();
      this.page = await context.newPage();
      console.log('✅ Edge launched with fresh context');
    }
  }

  async setupNetworkInterception() {
    console.log('🕸️ Setting up network request interception...');

    // Intercept all network requests
    this.page.on('request', (request) => {
      const url = request.url();
      const headers = request.headers();

      // Debug: Show all requests
      console.log(`🌐 REQUEST: ${url}`);
      if (headers.authorization || headers['x-usersessionid']) {
        console.log(`   🔑 Has auth headers`);
      }

      // Look for Teams assignments API calls
      if (url.includes('/api/v1.0/edu/me/work') ||
          (url.includes('/api/v1.0/edu/') && headers.authorization)) {

        console.log(`📡 🎯 ASSIGNMENTS API CALL: ${url}`);
        this.requestCount++;

        // Extract tokens
        if (headers.authorization) {
          this.tokens.AUI_TOKEN = headers.authorization.replace('Bearer ', '');
          console.log(`🔑 Extracted Bearer token: ${this.tokens.AUI_TOKEN.substring(0, 30)}...`);
        }

        if (headers['x-usersessionid']) {
          this.tokens.AUI_SESSION_ID = headers['x-usersessionid'];
          console.log(`🆔 Extracted session ID: ${this.tokens.AUI_SESSION_ID}`);
        }

        // Store the API URL (remove pagination tokens)
        this.tokens.AUI_URL = url.split('&$skiptoken=')[0];

        // Check if we have all required tokens
        if (this.tokens.AUI_TOKEN && this.tokens.AUI_SESSION_ID) {
          this.foundTokens = true;
          console.log('✅ Successfully extracted all required tokens!');
        }
      }

      // Also look for class members API calls
      if (url.includes('/api/v1.0/edu/classes/') && url.includes('/members') && headers.authorization) {
        console.log(`👥 CLASS MEMBERS API CALL: ${url}`);

        if (!this.tokens.AUI_TOKEN) {
          this.tokens.AUI_TOKEN = headers.authorization.replace('Bearer ', '');
          console.log(`🔑 Extracted token from members API: ${this.tokens.AUI_TOKEN.substring(0, 30)}...`);
        }

        if (!this.tokens.AUI_SESSION_ID && headers['x-usersessionid']) {
          this.tokens.AUI_SESSION_ID = headers['x-usersessionid'];
          console.log(`🆔 Extracted session ID from members API: ${this.tokens.AUI_SESSION_ID}`);
        }
      }
    });

    console.log('✅ Network interception set up');
  }

  async navigateToTeams() {
    console.log('🧭 Navigating to Teams web interface...');

    try {
      await this.page.goto('https://teams.microsoft.com/v2/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('✅ Successfully loaded Teams');

      // Wait a bit for the page to fully render
      await this.page.waitForTimeout(3000);

    } catch (error) {
      console.log('⚠️ Navigation error, continuing anyway:', error.message);
    }
  }

  async findAndClickAssignments() {
    console.log('🔍 Looking for assignments button...');

    // Try multiple selectors for assignments
    const assignmentSelectors = [
      'button[aria-label="Assignments"]',
      'button[aria-label*="Assignment"]',
      'a[href*="assignments"]',
      'button:has-text("Assignments")',
      '[data-tid*="assignment"]',
      'button[title*="Assignment"]'
    ];

    let clickedAssignments = false;

    for (const selector of assignmentSelectors) {
      try {
        console.log(`🔍 Trying selector: ${selector}`);

        // Wait for the element to be visible
        await this.page.waitForSelector(selector, { timeout: 5000, state: 'visible' });

        console.log('✅ Found assignments element, clicking...');
        await this.page.click(selector);

        // Wait for navigation/loading
        await this.page.waitForTimeout(2000);

        clickedAssignments = true;
        console.log('🎯 Successfully clicked assignments!');
        break;

      } catch (error) {
        console.log(`⚠️ Selector ${selector} failed: ${error.message}`);
        continue;
      }
    }

    if (!clickedAssignments) {
      console.log('⚠️ Could not find assignments button automatically');
      console.log('💡 Please manually click on "Assignments" in the Teams interface');
      console.log('⏳ Waiting 30 seconds for manual click...');
      await this.page.waitForTimeout(30000);
    }

    // Wait for assignments page to load and make API calls
    console.log('⏳ Waiting for assignments API calls...');
    await this.page.waitForTimeout(10000);
  }

  async waitForTokens() {
    console.log('⏳ Waiting for token extraction...');

    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();

    while (!this.foundTokens && (Date.now() - startTime) < maxWaitTime) {
      await this.page.waitForTimeout(1000);

      if (this.requestCount > 0) {
        console.log(`📊 Detected ${this.requestCount} API calls so far...`);
      }
    }

    return this.foundTokens;
  }

  validateToken(token) {
    if (!token) return false;

    try {
      // Basic JWT validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp > now) {
        const expiryDate = new Date(payload.exp * 1000);
        console.log(`🕒 Token expires: ${expiryDate.toLocaleString()}`);
        return true;
      }

      console.warn('⚠️ Token appears to be expired');
      return false;
    } catch (error) {
      console.warn('⚠️ Could not validate token:', error.message);
      return false;
    }
  }

  async updateEnvFile() {
    console.log('📝 Updating .env file with extracted tokens...');

    let envContent = '';
    try {
      envContent = fs.readFileSync('.env', 'utf8');
    } catch (error) {
      console.log('📄 Creating new .env file...');
    }

    // Update or add tokens
    const updates = [
      ['AUI_URL', this.tokens.AUI_URL],
      ['AUI_TOKEN', this.tokens.AUI_TOKEN],
      ['AUI_SESSION_ID', this.tokens.AUI_SESSION_ID]
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
    console.log('✅ Successfully updated .env file');

    // Show summary
    console.log('\n📋 Token Summary:');
    console.log(`   URL: ${this.tokens.AUI_URL?.split('?')[0]}...`);
    console.log(`   Token: ${this.tokens.AUI_TOKEN?.substring(0, 30)}...`);
    console.log(`   Session: ${this.tokens.AUI_SESSION_ID}`);
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    if (this.browser) {
      await this.browser.close();
    }
  }

  async extract() {
    try {
      await this.launchEdgeWithProfile();
      await this.setupNetworkInterception();
      await this.navigateToTeams();
      await this.findAndClickAssignments();

      const success = await this.waitForTokens();

      if (success && this.validateToken(this.tokens.AUI_TOKEN)) {
        await this.updateEnvFile();
        console.log('🎉 Token extraction completed successfully!');
        console.log(`📊 Extracted tokens from ${this.requestCount} API calls`);
        return true;
      } else {
        console.error('❌ Failed to extract valid tokens');
        console.log('💡 Try refreshing the assignments page or checking your login');
        return false;
      }

    } catch (error) {
      console.error('❌ Token extraction failed:', error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Auto-run if called directly
console.log('🔧 Starting Edge token extractor...');

const extractor = new EdgeTokenExtractor();

process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupt received, cleaning up...');
  await extractor.cleanup();
  process.exit(0);
});

extractor.extract().then(success => {
  console.log(`🏁 Extraction ${success ? 'succeeded' : 'failed'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Uncaught error:', error);
  process.exit(1);
});

export default EdgeTokenExtractor;