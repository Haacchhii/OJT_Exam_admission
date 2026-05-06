import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load backend .env first
dotenv.config({ path: new URL('../.env', import.meta.url) });
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  dotenv.config({ path: new URL('../../.env', import.meta.url) });
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in environment. Set DATABASE_URL or DIRECT_URL in .env or environment.');
  process.exit(2);
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const stmts = [
    // Basic index to support ORDER BY created_at DESC
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_results_created_at_desc ON exam_results (created_at DESC);`,
    // Covering index to avoid heap fetch for common columns
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_results_created_at_desc_cover ON exam_results (created_at DESC) INCLUDE (id, registration_id, total_score, max_possible, percentage, passed, essay_reviewed);`,
  ];

  for (const s of stmts) {
    try {
      console.log('Running:', s);
      const res = await client.query(s);
      console.log('OK');
    } catch (err) {
      console.error('Statement failed:', err.message || err);
    }
  }

  await client.end();
}

run();
