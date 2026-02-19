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
  }

  async fetchClassesAndAssignments() {
    const graphToken = this.extractGraphToken();
    if (!graphToken) {
      console.error('❌ No Graph API token found. Please add GRAPH_TOKEN to .env');
      return;
    }

    console.log('🔍 Fetching classes via Graph API...');

    // First, get all classes the user is in
    const classesResponse = await fetch('https://graph.microsoft.com/v1.0/education/me/classes', {
      headers: {
        'Authorization': `Bearer ${graphToken}`,
        'Accept': 'application/json'
      }
    });

    if (!classesResponse.ok) {
      console.error(`❌ Failed to fetch classes: ${classesResponse.status} ${classesResponse.statusText}`);
      return;
    }

    const classesData = await classesResponse.json();
    console.log(`✅ Found ${classesData.value.length} classes`);

    const allAssignments = [];

    // For each class, fetch assignments
    for (const classInfo of classesData.value.slice(0, 3)) { // Limit to 3 classes for testing
      console.log(`\n📚 Fetching assignments for class: ${classInfo.displayName}`);

      const assignmentsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/education/classes/${classInfo.id}/assignments?$expand=resources`, {
        headers: {
          'Authorization': `Bearer ${graphToken}`,
          'Accept': 'application/json'
        }
      });

      if (!assignmentsResponse.ok) {
        console.error(`❌ Failed to fetch assignments for ${classInfo.displayName}: ${assignmentsResponse.status}`);
        continue;
      }

      const assignmentsData = await assignmentsResponse.json();
      console.log(`  ✅ Found ${assignmentsData.value.length} assignments`);

      // Add class info to each assignment
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

    // Analyze the data
    this.analyzeAssignments(allAssignments);

    // Save raw Graph API data
    fs.writeFileSync('graph-assignments-raw.json', JSON.stringify(allAssignments, null, 2));
    console.log('💾 Saved raw Graph API data to graph-assignments-raw.json');

    return allAssignments;
  }

  analyzeAssignments(assignments) {
    console.log('\n🔍 Analysis of Graph API data:');

    // Check instructions/descriptions
    const withInstructions = assignments.filter(a =>
      a.instructions && a.instructions.content && a.instructions.content.trim()
    );
    console.log(`📝 Assignments with instructions: ${withInstructions.length}/${assignments.length}`);

    // Check createdBy users
    const createdByUsers = new Set();
    const modifiedByUsers = new Set();

    assignments.forEach(a => {
      if (a.createdBy?.user?.id) createdByUsers.add(a.createdBy.user.id);
      if (a.lastModifiedBy?.user?.id) modifiedByUsers.add(a.lastModifiedBy.user.id);
    });

    console.log(`👥 Unique creators: ${createdByUsers.size}`);
    console.log(`✏️  Unique modifiers: ${modifiedByUsers.size}`);

    // Show examples
    console.log('\n📋 Sample assignments:');
    assignments.slice(0, 3).forEach((a, i) => {
      console.log(`\n${i + 1}. "${a.displayName}"`);
      console.log(`   Class: ${a.classInfo?.displayName}`);
      console.log(`   Status: ${a.status}`);
      console.log(`   Due: ${a.dueDateTime}`);
      console.log(`   Instructions: ${a.instructions?.content?.substring(0, 100) || 'None'}${a.instructions?.content?.length > 100 ? '...' : ''}`);
      console.log(`   Created by: ${a.createdBy?.user?.id}`);
      console.log(`   Modified by: ${a.lastModifiedBy?.user?.id}`);
    });

    // Look for patterns that might indicate RERD vs BTP
    console.log('\n🔍 User ID patterns:');
    const userAssignments = {};

    assignments.forEach(a => {
      const creatorId = a.createdBy?.user?.id;
      if (creatorId) {
        if (!userAssignments[creatorId]) {
          userAssignments[creatorId] = [];
        }
        userAssignments[creatorId].push(a.displayName);
      }
    });

    Object.entries(userAssignments).forEach(([userId, assignmentNames]) => {
      console.log(`\n👤 User ${userId}:`);
      console.log(`   Assignments: ${assignmentNames.length}`);
      console.log(`   Examples: ${assignmentNames.slice(0, 3).join(', ')}`);
    });
  }

  extractGraphToken() {
    // For now, we'll need to manually extract from the JSON you provided
    // In a real implementation, this would be stored securely
    const graphToken = "eyJ0eXAiOiJKV1QiLCJub25jZSI6InE1d1J6c3pCU1Y2TW9IZ2ViT2JEaGRiOGRweTdjS3JOMTdtOVltbmg3NGMiLCJhbGciOiJSUzI1NiIsIng1dCI6IkpZaEFjVFBNWl9MWDZEQmxPV1E3SG4wTmVYRSIsImtpZCI6IkpZaEFjVFBNWl9MWDZEQmxPV1E3SG4wTmVYRSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC9jNmVmZGU1Yy04MTJmLTQ3MjgtOGY3Mi1kYmMxYTE0MDc1MDAvIiwiaWF0IjoxNzU4MDI0NDE4LCJuYmYiOjE3NTgwMjQ0MTgsImV4cCI6MTc1ODAyODQ5NiwiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsicDEiXSwiYWdlR3JvdXAiOiIyIiwiYWlvIjoiQVhRQWkvOFpBQUFBZXlwRWJTSkNrOW1KcCtWRlJXYzZzWUo2SmcrZ0M5aWx0ejFiVWZJamZub3NydHVwNFBuOEpkZlhSTmkwNmNMVW0rVGtwYWVreUlNUzJodFVZVUFyOHZ0ektFeU1KVFJ3N3FWUTZsdnFFWTRsU1l3dkJOR2dtT3ZwN2JSZE0wUnJORzl4MExiRENTV281K1lySVd4eEdnPT0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6IkFzc2lnbm1lbnRzIFVJIiwiYXBwaWQiOiJjY2I2NWJjZC0wNGJhLTQyMWEtODc5MS1hMjk5YTcwOTA0YjYiLCJhcHBpZGFjciI6IjAiLCJmYW1pbHlfbmFtZSI6IkthYmlyIiwiZ2l2ZW5fbmFtZSI6IkFobmFmIiwiaWR0eXAiOiJ1c2VyIiwiaXBhZGRyIjoiMTA0LjI4LjI0Ni4yMDYiLCJuYW1lIjoiS2FiaXIsIEFobmFmIChFSk5SKSIsIm9pZCI6IjAyOTdmZTliLTMwMDktNDI0ZS1hN2QyLTE3MzMyNWY1ZDNkNSIsIm9ucHJlbV9zaWQiOiJTLTEtNS0yMS0xMzIzNTgxMDE2LTE0MDA0NTk4MTUtMTQ3ODA2MjMxNC00NDk5MjAiLCJwbGF0ZiI6IjUiLCJwdWlkIjoiMTAwMzIwMDE2RTg1NjNFQyIsInJoIjoiMS5BUzhBWE43dnhpLUJLRWVQY3R2Qm9VQjFBQU1BQUFBQUFBQUF3QUFBQUFBQUFBQ3NBUm92QUEuIiwic2NwIjoiQ2hhbm5lbC5SZWFkQmFzaWMuQWxsIEVkdUFzc2lnbm1lbnRzLlJlYWRXcml0ZSBlbWFpbCBGaWxlcy5SZWFkV3JpdGUuQWxsIEdyb3VwLlJlYWQuQWxsIE5vdGVzLlJlYWRXcml0ZS5BbGwgb3BlbmlkIHByb2ZpbGUgU2l0ZXMuUmVhZFdyaXRlLkFsbCBUZWFtLlJlYWRCYXNpYy5BbGwgVXNlci5SZWFkIFVzZXIuUmVhZEJhc2ljLkFsbCIsInNpZCI6IjAwOGJjZDI5LWYxZjgtMTY3NS0yY2ViLWY0ODY1ODRjZDJkMSIsInN1YiI6IllNQUN2ZjJWX1ZZUF9DYXlJVWxfSTdnZW1yaUUyTjk0N1NyTE5NNmxSWm8iLCJ0ZW5hbnRfcmVnaW9uX3Njb3BlIjoiRVUiLCJ0aWQiOiJjNmVmZGU1Yy04MTJmLTQ3MjgtOGY3Mi1kYmMxYTE0MDc1MDAiLCJ1bmlxdWVfbmFtZSI6IkthYmlyLkFAZXRvbmNvbGxlZ2Uub3JnLnVrIiwidXBuIjoiS2FiaXIuQUBldG9uY29sbGVnZS5vcmcudWsiLCJ1dGkiOiJUQlFUWUs1OV9FeXU4R0pEWHlnUEFBIiwidmVyIjoiMS4wIiwid2lkcyI6WyJiNzlmYmY0ZC0zZWY5LTQ2ODktODE0My03NmIxOTRlODU1MDkiXSwieG1zX2Z0ZCI6IkdpYkc2RDliY3pDakl1MENUZzJpd0ZhaXg5bG5sNHpUeXN6LVh1YlZadDBCWlhWeWIzQmxibTl5ZEdodFpITnRjdyIsInhtc19pZHJlbCI6IjMyIDEiLCJ4bXNfc3QiOnsic3ViIjoiZUFObXVEOVR6T3hQY1VpSHJpMkRfSWhLMnpVYTN3enFycmJEV25BUG44NCJ9LCJ4bXNfdGNkdCI6MTQwNjgwMTc0N30.f9I_h_OjonvFG77OI4XhJBUvd6Y_JfsCCp7lZps-QOdVUeriPtboRKWTBIOZRSLdqXTNnniHFcs38ztVVwY6esmzyBgL14cWfVky-F2rmTO0oXQEPJffHTqpGk-qfD0drEdniflTV9sD90ivPwbaxQSrNyj50RJqzPVk1KMHcX_1PyONmCYkRVLveGPLGq-jS36eHV99HAmqbB2lszkydSdViKH8tdan1o099w5E9ARtAqroHQ-_KrnHTjzHzP7wqWnrnVuMHpYrZS7MiV4TWuMKHUFqLygfTNZf3wHzI4mbPm44j2VBQYznHrNUMS35kbdKIY60RXbHHaehY8M6zw";

    return graphToken;
  }
}

async function main() {
  const sync = new GraphAssignmentSync();
  await sync.fetchClassesAndAssignments();
}

main().catch(console.error);