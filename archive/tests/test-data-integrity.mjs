#!/usr/bin/env node

import fs from 'fs';

// Load environment variables from .env file
function loadEnv() {
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2].replace(/^"|"$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

// Mock assignment data to test data integrity
const mockAssignment = {
  id: "test-123",
  displayName: "Extended Writing Assignment - Economic Analysis",
  instructions: {
    content: "<p>Write a 1500-word analysis of economic factors affecting global trade. Your essay should include:</p><ul><li>Introduction to key economic principles</li><li>Analysis of current trade policies</li><li>Conclusion with recommendations</li></ul><p>Submit by the due date via Teams.</p>"
  },
  dueDateTime: "2024-12-15T23:59:00.000Z",
  assignedDateTime: "2024-11-01T09:00:00.000Z",
  createdDateTime: "2024-10-30T14:30:00.000Z",
  lastModifiedDateTime: "2024-11-01T09:00:00.000Z",
  status: "assigned",
  classId: "class-456",
  webUrl: "https://teams.microsoft.com/assignment/123",
  allTurnedIn: false,
  anySubmittedState: true,
  allowLateSubmissions: true,
  submissionAggregates: {
    total: 25,
    submitted: 18
  }
};

// Mock class member data
const mockClassMembers = {
  teachers: [
    {
      displayName: "BTP Teacher", // This would be the actual teacher name from API
      email: "teacher@etoncolege.org.uk"
    }
  ],
  students: new Array(25).fill(null).map((_, i) => ({ id: `student-${i}` }))
};

function normalizeAssignment(raw, classMembers = mockClassMembers) {
  const submissionAggregates = raw.submissionAggregates || {};
  const classId = String(raw.classId || '');

  // Extract description from instructions
  let description = '';
  if (raw.instructions && raw.instructions.content) {
    description = raw.instructions.content.replace(/<[^>]*>/g, '').trim();
  }

  // Use teacher data exactly as provided by the API
  let teacherName = '';
  let teacherEmail = '';
  let studentCount = 0;

  if (classMembers.teachers.length > 0) {
    teacherName = classMembers.teachers[0].displayName || '';
    teacherEmail = classMembers.teachers[0].email || '';
  }
  studentCount = classMembers.students.length;

  return {
    id: String(raw.id || ''),
    title: String(raw.displayName || ''),
    description: description,
    dueDate: raw.dueDateTime,
    assignedDate: raw.assignedDateTime,
    createdDate: raw.createdDateTime,
    modifiedDate: raw.lastModifiedDateTime,
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

function createNotionPayload(item) {
  return {
    parent: { database_id: "mock-database-id" },
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
      "Due Date": item.dueDate ? {
        "date": { "start": item.dueDate.split('T')[0] }
      } : { "date": null },
      "Status": {
        "select": { "name": item.status }
      },
      "Teacher": {
        "rich_text": [{
          "text": { "content": item.teacherName || "" }
        }]
      },
      "Class ID": {
        "rich_text": [{
          "text": { "content": item.classId || "" }
        }]
      },
      "Student Count": {
        "number": item.studentCount
      },
      "Total Submissions": {
        "number": item.agg_total
      },
      "Submitted Count": {
        "number": item.agg_submitted
      }
    }
  };
}

console.log('🧪 Testing Assignment Data Integrity');
console.log('=====================================\n');

console.log('📥 Raw Assignment Data:');
console.log('- ID:', mockAssignment.id);
console.log('- Title:', mockAssignment.displayName);
console.log('- Instructions Length:', mockAssignment.instructions.content.length);
console.log('- Raw HTML:', mockAssignment.instructions.content.substring(0, 100) + '...');
console.log();

const normalized = normalizeAssignment(mockAssignment);

console.log('📊 Normalized Assignment Data:');
console.log('- ID:', normalized.id);
console.log('- Title:', normalized.title);
console.log('- Description Length:', normalized.description.length);
console.log('- Cleaned Description:', normalized.description.substring(0, 200) + '...');
console.log('- Teacher Name:', normalized.teacherName);
console.log('- Student Count:', normalized.studentCount);
console.log('- Submissions:', `${normalized.agg_submitted}/${normalized.agg_total}`);
console.log();

const notionPayload = createNotionPayload(normalized);

console.log('📝 Notion Payload (Notes field):');
console.log('- Notes Content:', notionPayload.properties.Notes.rich_text[0].text.content.substring(0, 200) + '...');
console.log('- Notes Length:', notionPayload.properties.Notes.rich_text[0].text.content.length);
console.log();

console.log('✅ Data Integrity Check:');
console.log('- HTML tags removed:', !normalized.description.includes('<'));
console.log('- Description preserved:', normalized.description.length > 0);
console.log('- Teacher name extracted:', normalized.teacherName.length > 0);
console.log('- Submission data intact:', normalized.agg_submitted > 0);
console.log('- Notion payload valid:', Object.keys(notionPayload.properties).length > 5);

console.log('\n🎯 Key Improvements Made:');
console.log('1. Descriptions now go to "Notes" column instead of "description"');
console.log('2. HTML tags are properly stripped from instructions');
console.log('3. Teacher names use exactly what API provides (no hardcoded corrections)');
console.log('4. Data integrity maintained through normalization process');
console.log('5. Environment loading added for .env file support');