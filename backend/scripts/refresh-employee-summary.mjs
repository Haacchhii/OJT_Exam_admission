import prisma from '../src/config/db.js';
import { invalidatePrefix } from '../src/utils/cache.js';

async function refresh() {
  // Create or refresh materialized view with minimal pre-joined fields used by employee-summary
  const createMv = `
  CREATE MATERIALIZED VIEW IF NOT EXISTS employee_summary_mv AS
  SELECT
    r.id AS result_id,
    r.registration_id,
    r.total_score,
    r.max_possible,
    r.percentage,
    r.passed,
    r.essay_reviewed,
    r.created_at,

    reg.schedule_id,
    reg.user_email,
    reg.user_id,
    reg.status AS registration_status,

    u.first_name,
    u.last_name,

    s.scheduled_date,
    s.start_time,
    s.end_time,
    s.exam_id,

    e.title AS exam_title,
    e.grade_level AS exam_grade_level,
    e.passing_score
  FROM exam_results r
  JOIN exam_registrations reg ON reg.id = r.registration_id
  LEFT JOIN users u ON u.id = reg.user_id
  LEFT JOIN exam_schedules s ON s.id = reg.schedule_id
  LEFT JOIN exams e ON e.id = s.exam_id
  ;`;

  const refreshConcurrently = `REFRESH MATERIALIZED VIEW CONCURRENTLY employee_summary_mv;`;
  const refreshFallback = `REFRESH MATERIALIZED VIEW employee_summary_mv;`;

  try {
    console.log('Creating materialized view (if not exists)...');
    await prisma.$executeRawUnsafe(createMv);
    console.log('Attempting concurrent refresh of materialized view...');
    try {
      await prisma.$executeRawUnsafe(refreshConcurrently);
    } catch (err) {
      console.warn('Concurrent refresh failed, falling back to non-concurrent refresh:', err.message);
      await prisma.$executeRawUnsafe(refreshFallback);
    }
    console.log('Materialized view refreshed.');
    try {
      console.log('Invalidating summary cache prefix...');
      await invalidatePrefix('resultsEmployeeSummary');
    } catch (err) {
      console.warn('Failed to invalidate cache prefix after refresh:', err?.message || err);
    }

    try {
      console.log('Ensuring MV indexes exist...');
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_summary_mv_result_id ON employee_summary_mv(result_id);');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_employee_summary_mv_created_at_desc ON employee_summary_mv(created_at DESC);');
    } catch (err) {
      console.warn('Failed to create MV indexes (may require manual run):', err?.message || err);
    }
  } catch (err) {
    console.error('Failed to create/refresh materialized view:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

refresh();
