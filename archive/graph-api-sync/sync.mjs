#!/usr/bin/env node

import fs from 'fs';

function loadEnv() {
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

class GraphAssignmentSync {
  constructor() {
    this.envVars = loadEnv();
    this.graphToken = this.extractGraphToken();
    this.notionToken = this.envVars.NOTION_TOKEN;
    this.notionDatabaseId = this.envVars.NOTION_DATABASE_ID;
  }

  extractGraphToken() {
    if (this.envVars.GRAPH_TOKEN) {
      return this.envVars.GRAPH_TOKEN;
    }

    console.log('⚠️  No GRAPH_TOKEN in .env file');
    return null;
  }

  async fetchClassesAndAssignments() {
    if (!this.graphToken) {
      console.error('❌ No Graph API token found');
      return [];
    }

    console.log('🔍 Fetching classes via Graph API...');

    // Try the me endpoint first to verify token works
    const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${this.graphToken}`,
        'Accept': 'application/json'
      }
    });

    if (!meResponse.ok) {
      const errorText = await meResponse.text();
      console.error(`❌ Failed to authenticate with Graph API: ${meResponse.status}`);
      console.error('Error details:', errorText);
      return [];
    }

    const meData = await meResponse.json();
    console.log('✅ Authenticated as:', meData.displayName);

    const classesResponse = await fetch('https://graph.microsoft.com/v1.0/education/me/classes', {
      headers: {
        'Authorization': `Bearer ${this.graphToken}`,
        'Accept': 'application/json'
      }
    });

    if (!classesResponse.ok) {
      console.error(`❌ Failed to fetch classes: ${classesResponse.status} ${classesResponse.statusText}`);
      return [];
    }

    const classesData = await classesResponse.json();
    console.log(`✅ Found ${classesData.value.length} classes`);

    const allAssignments = [];

    for (const classInfo of classesData.value) {
      console.log(`\n📚 Fetching assignments for class: ${classInfo.displayName}`);

      const assignmentsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/education/classes/${classInfo.id}/assignments?$expand=resources,submissions`, {
        headers: {
          'Authorization': `Bearer ${this.graphToken}`,
          'Accept': 'application/json'
        }
      });

      if (!assignmentsResponse.ok) {
        console.error(`❌ Failed to fetch assignments for ${classInfo.displayName}: ${assignmentsResponse.status}`);
        continue;
      }

      const assignmentsData = await assignmentsResponse.json();
      console.log(`  ✅ Found ${assignmentsData.value.length} assignments`);

      assignmentsData.value.forEach(assignment => {
        assignment.classInfo = {
          id: classInfo.id,
          displayName: classInfo.displayName,
          description: classInfo.description
        };
        allAssignments.push(assignment);
      });
    }

    console.log(`\n📊 Total assignments from Graph API: ${allAssignments.length}`);
    return allAssignments;
  }

  normalizeAssignment(raw) {
    let description = '';
    if (raw.instructions && raw.instructions.content) {
      description = raw.instructions.content.replace(/<[^>]*>/g, '').trim();
    }

    let teacher = 'Unknown';
    if (raw.createdBy?.user?.displayName) {
      teacher = raw.createdBy.user.displayName;
    }

    return {
      id: raw.id,
      title: raw.displayName || 'Untitled Assignment',
      description: description.substring(0, 2000),
      dueDate: raw.dueDateTime ? new Date(raw.dueDateTime).toISOString() : null,
      status: raw.status || 'assigned',
      teacher: teacher,
      class: raw.classInfo?.displayName || 'Unknown Class',
      source: 'graph-api'
    };
  }

  async syncToNotion(assignments) {
    if (!this.notionToken || !this.notionDatabaseId) {
      console.error('❌ Missing Notion configuration');
      return;
    }

    console.log(`\n📝 Syncing ${assignments.length} assignments to Notion...`);

    for (const assignment of assignments) {
      const payload = {
        parent: { database_id: this.notionDatabaseId },
        properties: {
          Title: { title: [{ text: { content: assignment.title } }] },
          Description: { rich_text: [{ text: { content: assignment.description || '' } }] },
          'Due Date': assignment.dueDate ? { date: { start: assignment.dueDate } } : { date: null },
          Status: { select: { name: assignment.status } },
          Teacher: { rich_text: [{ text: { content: assignment.teacher } }] },
          Class: { rich_text: [{ text: { content: assignment.class } }] },
          Source: { rich_text: [{ text: { content: assignment.source } }] }
        }
      };

      try {
        const response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ Synced: ${assignment.title}`);
        } else {
          const error = await response.text();
          console.error(`❌ Failed to sync "${assignment.title}": ${response.status} - ${error}`);
        }
      } catch (error) {
        console.error(`❌ Error syncing "${assignment.title}": ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async run() {
    try {
      const rawAssignments = await this.fetchClassesAndAssignments();
      if (rawAssignments.length === 0) return;

      const normalizedAssignments = rawAssignments.map(a => this.normalizeAssignment(a));

      console.log('\n📋 Sample normalized assignments:');
      normalizedAssignments.slice(0, 3).forEach((a, i) => {
        console.log(`\n${i + 1}. "${a.title}"`);
        console.log(`   Class: ${a.class}`);
        console.log(`   Teacher: ${a.teacher}`);
        console.log(`   Due: ${a.dueDate}`);
        console.log(`   Description: ${a.description.substring(0, 100)}${a.description.length > 100 ? '...' : ''}`);
      });

      // Comment out Notion sync for testing - uncomment when ready
      // await this.syncToNotion(normalizedAssignments);

    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }
}

async function main() {
  const sync = new GraphAssignmentSync();
  await sync.run();
}

main().catch(console.error);