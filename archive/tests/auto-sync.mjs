#!/usr/bin/env node

/*
 * auto-sync.mjs - Fully Automated Assignment Sync with Token Refresh
 * 
 * This script will:
 * 1. Try to run the sync with existing tokens
 * 2. If tokens are expired, automatically refresh them
 * 3. Retry the sync with fresh tokens
 * 
 * Usage: node auto-sync.mjs [sync-args]
 */

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';

class AutoSync {
  constructor() {
    this.maxRetries = 2;
  }

  async runSync(args = ['--full']) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Running sync with args: ${args.join(' ')}`);
      
      const proc = spawn('node', ['sync-assignments.mjs', ...args], {
        stdio: 'pipe',
        env: { ...process.env, ...this.loadEnv() }
      });
      
      let output = '';
      let hasError = false;
      
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });
      
      proc.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        if (text.includes('Authorization failed')) {
          hasError = true;
          console.log('🔑 Token expired, will refresh...');
        } else {
          process.stderr.write(text);
        }
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else if (hasError) {
          resolve({ success: false, needsRefresh: true, output });
        } else {
          reject(new Error(`Sync failed with code ${code}`));
        }
      });
    });
  }

  loadEnv() {
    if (!fs.existsSync('.env')) return {};
    
    const envContent = fs.readFileSync('.env', 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1]] = match[2].replace(/^"|"$/g, '');
      }
    });
    
    return env;
  }

  async refreshTokens() {
    console.log('🔄 Refreshing tokens automatically...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let tokens = { AUI_URL: null, AUI_TOKEN: null, AUI_SESSION_ID: null };
    let foundTokens = false;
    
    page.on('request', (request) => {
      const url = request.url();
      const headers = request.headers();
      
      if (url.includes('/api/v1.0/edu/me/work')) {
        tokens.AUI_URL = url.split('&$skiptoken=')[0];
        tokens.AUI_TOKEN = headers.authorization?.replace('Bearer ', '');
        tokens.AUI_SESSION_ID = headers['x-usersessionid'];
        
        if (tokens.AUI_TOKEN && tokens.AUI_SESSION_ID) {
          foundTokens = true;
        }
      }
    });
    
    try {
      await page.goto('https://assignments.onenote.com/');
      
      // Wait for user interaction and token extraction
      let attempts = 0;
      while (!foundTokens && attempts < 120) { // 2 minutes
        await page.waitForTimeout(1000);
        attempts++;
        
        if (attempts === 10) {
          console.log('📱 Please log in and navigate to assignments...');
        }
        if (attempts % 30 === 0 && attempts > 10) {
          console.log(`⏳ Still waiting for API calls... (${attempts}s/120s)`);
        }
      }
      
      if (foundTokens) {
        const envContent = [
          `AUI_URL="${tokens.AUI_URL}"`,
          `AUI_TOKEN="${tokens.AUI_TOKEN}"`,
          `AUI_SESSION_ID="${tokens.AUI_SESSION_ID}"`
        ].join('\n');
        
        fs.writeFileSync('.env', envContent);
        console.log('✅ Tokens refreshed successfully!');
        return true;
      } else {
        console.log('❌ Failed to capture fresh tokens');
        return false;
      }
      
    } finally {
      await browser.close();
    }
  }

  async run(args) {
    let attempt = 1;
    
    while (attempt <= this.maxRetries) {
      console.log(`\n📝 Sync attempt ${attempt}/${this.maxRetries}`);
      
      const result = await this.runSync(args);
      
      if (result.success) {
        console.log('🎉 Sync completed successfully!');
        return;
      }
      
      if (result.needsRefresh && attempt < this.maxRetries) {
        console.log('🔐 Tokens expired, attempting refresh...');
        
        const refreshed = await this.refreshTokens();
        if (!refreshed) {
          console.log('❌ Token refresh failed');
          break;
        }
        
        console.log('🔄 Retrying sync with fresh tokens...');
        attempt++;
      } else {
        console.log('❌ Sync failed');
        break;
      }
    }
    
    if (attempt > this.maxRetries) {
      console.log('⚠️  Max retries exceeded');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new AutoSync();
  const args = process.argv.slice(2);
  sync.run(args.length ? args : ['--full']).catch(console.error);
}