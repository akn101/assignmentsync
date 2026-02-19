#!/usr/bin/env node

/*
 * token-stealer.mjs - Automated Microsoft Teams Token Extractor
 * 
 * Usage:
 * 1. npm install playwright
 * 2. npx playwright install chromium
 * 3. node token-stealer.mjs
 * 
 * This will:
 * - Open Teams assignments page
 * - Wait for you to log in (if needed)
 * - Intercept API calls to extract tokens
 * - Update .env file with fresh tokens
 */

import { chromium } from 'playwright';
import fs from 'fs';

class TokenStealer {
  constructor() {
    this.tokens = {
      AUI_URL: null,
      AUI_TOKEN: null,
      AUI_SESSION_ID: null
    };
    this.foundTokens = false;
  }

  async extractTokens() {
    console.log('🔍 Starting automated token extraction...');
    
    const browser = await chromium.connectOverCDP('http://localhost:9222') || 
                       await chromium.launch({ 
                         headless: false, // Keep visible so you can log in
                         args: [
                           '--disable-web-security', // Sometimes needed for Teams
                           '--remote-debugging-port=9222' // Enable CDP connection
                         ]
                       });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept network requests
    page.on('request', (request) => {
      const url = request.url();
      const headers = request.headers();
      
      // Look for assignments API calls
      if (url.includes('/api/v1.0/edu/me/work')) {
        console.log('📡 Found work API call:', url.split('?')[0]);
        
        this.tokens.AUI_URL = url.split('&$skiptoken=')[0]; // Remove pagination token
        this.tokens.AUI_TOKEN = headers.authorization?.replace('Bearer ', '');
        this.tokens.AUI_SESSION_ID = headers['x-usersessionid'];
        
        if (this.tokens.AUI_TOKEN && this.tokens.AUI_SESSION_ID) {
          this.foundTokens = true;
          console.log('✅ Extracted tokens from work API!');
        }
      }
      
      // Look for class members API calls
      if (url.includes('/api/v1.0/edu/classes/') && url.includes('/members')) {
        console.log('👥 Found members API call');
        
        if (!this.tokens.AUI_TOKEN) {
          this.tokens.AUI_TOKEN = headers.authorization?.replace('Bearer ', '');
        }
        if (!this.tokens.AUI_SESSION_ID) {
          this.tokens.AUI_SESSION_ID = headers['x-usersessionid'];
        }
      }
    });

    try {
      console.log('🌐 Opening Microsoft Teams assignments...');
      await page.goto('https://assignments.onenote.com/');
      
      console.log('⏳ Waiting for login and initial page load...');
      console.log('   → Please log in if prompted');
      console.log('   → Navigate to assignments if needed');
      console.log('   → The script will auto-detect API calls');
      
      // Wait for either tokens to be found or timeout
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds
      
      while (!this.foundTokens && attempts < maxAttempts) {
        await page.waitForTimeout(1000);
        attempts++;
        
        if (attempts % 10 === 0) {
          console.log(`⏱️  Still waiting... (${attempts}s/${maxAttempts}s)`);
          console.log('   Try refreshing the page or clicking on assignments');
        }
      }
      
      if (this.foundTokens) {
        await this.saveTokens();
        console.log('🎉 Token extraction completed successfully!');
      } else {
        console.log('⚠️  No tokens found. Make sure you:');
        console.log('   1. Logged into Teams');
        console.log('   2. Navigated to assignments');
        console.log('   3. The page loaded assignment data');
      }
      
    } catch (error) {
      console.error('❌ Error during extraction:', error.message);
    } finally {
      await browser.close();
    }
  }

  async saveTokens() {
    const envContent = [
      `AUI_URL="${this.tokens.AUI_URL}"`,
      `AUI_TOKEN="${this.tokens.AUI_TOKEN}"`,
      `AUI_SESSION_ID="${this.tokens.AUI_SESSION_ID}"`
    ].join('\n');
    
    // Backup existing .env
    if (fs.existsSync('.env')) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      fs.copyFileSync('.env', `.env.backup.${timestamp}`);
      console.log('💾 Backed up existing .env file');
    }
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ Updated .env file with fresh tokens');
    
    // Show token info (redacted)
    console.log('\n📋 Token Summary:');
    console.log(`   URL: ${this.tokens.AUI_URL?.split('?')[0]}...`);
    console.log(`   Token: ${this.tokens.AUI_TOKEN?.substring(0, 20)}...`);
    console.log(`   Session: ${this.tokens.AUI_SESSION_ID}`);
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const stealer = new TokenStealer();
  stealer.extractTokens().catch(console.error);
}