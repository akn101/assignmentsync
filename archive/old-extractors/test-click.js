#!/usr/bin/env node

/*
 * test-click.js - Simple test to click assignments button
 */

import CDP from 'chrome-remote-interface';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const TEAMS_APP_PATH = '/Applications/Microsoft Teams.app/Contents/MacOS/MSTeams';
const DEBUG_PORT = 9222;

async function killExistingTeams() {
  try {
    console.log('🔄 Killing existing Teams processes...');
    await execAsync('pkill -f "MSTeams"');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    // Ignore if no processes
  }
}

async function launchTeams() {
  console.log('🚀 Launching Teams with debugging...');

  const teamsArgs = [
    '--remote-debugging-port=' + DEBUG_PORT,
    '--enable-logging'
  ];

  const teamsProcess = spawn(TEAMS_APP_PATH, teamsArgs, {
    stdio: 'ignore',
    detached: false
  });

  console.log('⏳ Waiting 10 seconds for Teams to load...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  return teamsProcess;
}

async function connectAndClick() {
  console.log('🔌 Connecting to Teams debugger...');

  let client;
  let retries = 10;

  while (retries > 0) {
    try {
      client = await CDP({ port: DEBUG_PORT });
      console.log('✅ Connected!');
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const { Runtime } = client;

  console.log('🔍 Looking for assignments button...');

  // First, let's see what's actually on the page
  const debugResult = await Runtime.evaluate({
    expression: `
      console.log("=== DEBUG INFO ===");
      console.log("Page URL:", window.location.href);
      console.log("Page title:", document.title);

      const allButtons = document.querySelectorAll('button');
      console.log("Total buttons found:", allButtons.length);

      const buttonsWithAria = document.querySelectorAll('button[aria-label]');
      console.log("Buttons with aria-label:", buttonsWithAria.length);

      for (let i = 0; i < Math.min(buttonsWithAria.length, 20); i++) {
        console.log("Button " + i + ":", buttonsWithAria[i].getAttribute('aria-label'));
      }

      const assignmentsBtn = document.querySelector('button[aria-label="Assignments"]');
      console.log("Assignments button found:", !!assignmentsBtn);

      if (assignmentsBtn) {
        console.log("Button HTML:", assignmentsBtn.outerHTML.substring(0, 300));
      }

      "debug-complete";
    `,
    returnByValue: true
  });

  console.log('🔍 Debug result:', debugResult.result.value);

  // Now try to click
  console.log('🖱️  Attempting to click assignments button...');

  const clickResult = await Runtime.evaluate({
    expression: `
      const btn = document.querySelector('button[aria-label="Assignments"]');
      if (btn) {
        console.log("Found button, clicking...");
        btn.click();
        "clicked-successfully";
      } else {
        console.log("Button not found");
        "button-not-found";
      }
    `,
    returnByValue: true
  });

  console.log('🔄 Click result:', clickResult.result.value);

  await client.close();
  return clickResult.result.value === "clicked-successfully";
}

async function main() {
  let teamsProcess;

  try {
    await killExistingTeams();
    teamsProcess = await launchTeams();

    const success = await connectAndClick();

    if (success) {
      console.log('✅ Successfully clicked assignments button!');
    } else {
      console.log('❌ Failed to click assignments button');
    }

    console.log('⏸️  Teams is still running - check manually if assignments opened');
    console.log('📝 Press Ctrl+C when done');

    // Keep alive
    await new Promise(resolve => {
      process.on('SIGINT', () => {
        console.log('\n🧹 Cleaning up...');
        if (teamsProcess) teamsProcess.kill();
        resolve();
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (teamsProcess) teamsProcess.kill();
  }
}

main();