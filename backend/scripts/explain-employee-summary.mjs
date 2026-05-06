import url from 'url';
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Prefer the backend/.env file where DATABASE_URL is defined
dotenv.config({ path: new URL('../.env', import.meta.url) });
// Also allow loading from workspace root .env as fallback
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

  // Build SQL that mirrors the Prisma findMany select/join structure used in getEmployeeSummary
  const sql = `
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT r.id as result_id, r.registration_id, r.total_score, r.max_possible, r.percentage, r.passed, r.essay_reviewed, r.created_at,
  reg.id as reg_id, reg.schedule_id, reg.user_email, reg.user_id, reg.status as reg_status,
  usr.id as user_id, usr.first_name, usr.last_name, usr.email as user_email,
  sch.id as schedule_id, sch.exam_id, sch.scheduled_date, sch.start_time, sch.end_time,
  ex.id as exam_id, ex.title as exam_title, ex.grade_level as exam_grade_level, ex.passing_score
FROM exam_results r
JOIN exam_registrations reg ON reg.id = r.registration_id
LEFT JOIN users usr ON usr.id = reg.user_id
LEFT JOIN exam_schedules sch ON sch.id = reg.schedule_id
LEFT JOIN exams ex ON ex.id = sch.exam_id
ORDER BY r.created_at DESC
LIMIT $1;
`;

  try {
    const limit = process.argv[2] ? Number(process.argv[2]) : 20;
    const res = await client.query(sql, [limit]);
    // Print the explain plan rows
    for (const row of res.rows) {
      console.log(row['QUERY PLAN']);
    }
  } catch (err) {
    console.error('Failed to run EXPLAIN:', err.message || err);
  } finally {
    await client.end();
  }
}

run();
