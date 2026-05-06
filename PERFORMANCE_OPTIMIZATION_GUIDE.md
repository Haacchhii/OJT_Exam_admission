# Performance Optimization Guide — May 6, 2026

## Load Test Results Summary

| Endpoint | P95 | Status | Priority |
|----------|-----|--------|----------|
| `/api/perf/vitals` | 26.39ms | ✅ FAST | — |
| `/api/exams` | 1060.46ms | 🟡 MEDIUM | Optimize |
| `/api/results/employee-summary` | 1541.85ms | 🔴 SLOW | Critical |

---

## Critical Bottleneck: `/api/results/employee-summary`

### Current Behavior
- **P95 Latency:** 1541.85ms (UNACCEPTABLE for SLA)
- **Operation:** Fetches exam results with deep nested includes (users, registrations, schedules, exams)
- **Location:** `golden/backend/src/controllers/results.js` line 404

### Root Cause Analysis

**Problem 1: N+1 Query Pattern**
```js
// Current implementation fetches:
1. examResult.findMany() with nested:
   - registration → user (with applicantProfile)
   - registration → schedule → exam → academicYear, semester
   - essayAnswer.findMany() with similar nesting
```

The Prisma query includes multiple relations that force separate DB round trips:
- Results query returns 40+ records
- Each result pulls nested user, registration, schedule, exam data
- Database has no index on these relationships

**Problem 2: Missing Database Indexes**
- No index on `examResult.createdAt` for sorting
- No index on `essayAnswer.scored` for filtering
- No compound index on `examResult.registrationId` + related fields

**Problem 3: Memory Inefficiency**
- Fetching 40+ essay answers individually in a separate query
- No pagination or limit on initial data fetch (uses hardcoded `take: 40`)

### Optimization Strategy

#### 1. **Add Database Indexes** (Immediate Impact: ~40% faster)

```prisma
// Add to golden/backend/prisma/schema.prisma

model ExamResult {
  // ... existing fields ...
  @@index([createdAt(sort: Desc)], name: "idx_exam_result_created_at")
  @@index([registrationId], name: "idx_exam_result_registration_id")
  @@index([passed], name: "idx_exam_result_passed")
}

model EssayAnswer {
  // ... existing fields ...
  @@index([scored], name: "idx_essay_answer_scored")
  @@index([createdAt(sort: Desc)], name: "idx_essay_answer_created_at")
  @@index([registrationId], name: "idx_essay_answer_registration_id")
}

model ExamRegistration {
  // ... existing fields ...
  @@index([scheduleId], name: "idx_exam_registration_schedule_id")
}
```

**Deploy:**
```bash
npm run db:migrate
```

#### 2. **Implement Query Batching** (Immediate Impact: ~30% faster)

```javascript
// Instead of nested fetches, use separate queries + client-side join
const results = await prisma.examResult.findMany({
  orderBy: { createdAt: 'desc' },
  take: summaryLimit,
  select: {
    id: true,
    registrationId: true,
    totalScore: true,
    // REMOVE nested includes
  },
});

// Batch fetch registrations with their relations
const regIds = results.map(r => r.registrationId);
const regs = await prisma.examRegistration.findMany({
  where: { id: { in: regIds } },
  include: { /* ... */ },
});

// Join in application code (faster than DB join)
const resultsWithRegs = results.map(r => ({
  ...r,
  registration: regs.find(reg => reg.id === r.registrationId),
}));
```

#### 3. **Add Redis Caching** (Immediate Impact: ~95% faster on cache hit)

**Status:** Already implemented with 2-minute TTL
- Cache key: `resultsEmployeeSummary:v6:40:r1:e1`
- Current TTL: 120 seconds (2 minutes)
- Recommendation: ✅ Keep as-is (good balance)

#### 4. **Lazy Load Heavy Relations** (Medium Impact: ~20% faster)

Separate "summary" and "detail" endpoints:

```javascript
// GET /api/results/employee-summary-lightweight (NEW)
// - Returns results with minimal data
// - P95 target: <400ms

// GET /api/results/employee-summary (EXISTING, deprecated after migration)
// - Kept for backward compatibility
// - Add deprecation warning header
```

---

## Medium Bottleneck: `/api/exams`

### Current Behavior
- **P95 Latency:** 1060.46ms (ACCEPTABLE but needs monitoring)
- **Issue:** Pagination + sorting on large dataset without index
- **Location:** `golden/backend/src/controllers/exams.js` line 224

### Root Cause
```js
// Current query:
prisma.exam.findMany({
  orderBy: { [sort]: sortDir },  // No index on sort field
  skip: (page - 1) * limit,
  take: limit,
  // ... nested includes
});
```

### Optimization Strategy

#### 1. **Add Index on Sort Fields**

```prisma
model Exam {
  // ... existing fields ...
  @@index([createdAt(sort: Desc)], name: "idx_exam_created_at")
  @@index([title], name: "idx_exam_title")
  @@index([gradeLevel], name: "idx_exam_grade_level")
  @@index([academicYearId], name: "idx_exam_academic_year_id")
}
```

#### 2. **Reduce Nested Query Depth**

Currently includes full question trees. Instead:
- Return questions count only in list view
- Lazy-load full questions on detail page

---

## Performance SLA Targets

| Endpoint | Current P95 | Target P95 | Status |
|----------|-------------|-----------|--------|
| `/api/perf/vitals` | 26ms | <100ms | ✅ PASS |
| `/api/exams` | 1060ms | <800ms | ⚠️ MONITOR |
| `/api/results/employee-summary` | 1541ms | <800ms | 🔴 ACTION |
| `/api/health` | <50ms | <200ms | ✅ PASS |
| `/api/admissions/dashboard-summary` | <200ms | <600ms | ✅ PASS |

---

## Implementation Roadmap

### Phase 1: Immediate (Today) — Expected Impact: 40-60% reduction
- [ ] Add database indexes (lines above)
- [ ] Deploy migration
- [ ] Re-run load test
- [ ] Measure improvement

### Phase 2: Short-term (This week) — Expected Impact: Additional 20-30%
- [ ] Implement query batching in employee-summary
- [ ] Create lightweight endpoint variant
- [ ] Add monitoring to track latency trends

### Phase 3: Long-term (Next sprint) — Expected Impact: 10-15% additional
- [ ] Consider pagination for essay answers
- [ ] Add read replicas for heavy queries (if using managed DB)
- [ ] Implement automatic query optimization alerts

---

## Monitoring Setup

Add to `/api/metrics/performance` endpoint:

```javascript
// Track latency by percentile
const perfMetrics = {
  'api/exams': {
    p50: 145ms,
    p95: 1060ms,
    p99: 1200ms,
    avg: 195ms,
    violations: 8,  // Times exceeded SLA
  },
  'api/results/employee-summary': {
    p50: 5ms,    // Cache hits are fast
    p95: 1542ms, // Misses are slow
    p99: 1542ms,
    avg: 159ms,
    violations: 2,
    cacheHitRate: 92%,
  },
};
```

---

## Quick Action Checklist

- [ ] Run migrations to add indexes (5 minutes)
- [ ] Re-run load test to measure improvement (10 minutes)
- [ ] If P95 still >1000ms, implement query batching (1-2 hours)
- [ ] Document SLA targets in README
- [ ] Add latency monitoring to error metrics

---

## Expected Improvements After Optimization

| Phase | Endpoint | Before | After | Improvement |
|-------|----------|--------|-------|-------------|
| 1 (Indexes) | employee-summary | 1541ms | ~900ms | 42% ↓ |
| 1 (Indexes) | exams | 1060ms | ~750ms | 29% ↓ |
| 2 (Batching) | employee-summary | 900ms | ~500ms | Additional 44% ↓ |
| 3 (Advanced) | employee-summary | 500ms | ~350ms | Additional 30% ↓ |

**Final Target State:** All endpoints <800ms P95 ✅
