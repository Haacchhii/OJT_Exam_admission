# Exam Visibility and Student Viewing Flow

**Last Updated:** March 25, 2026  
**Status:** Implemented in Phase 18

---

## Overview

This document describes how students view available exams and the date range visibility feature that allows exams to be visible for a limited time period (e.g., 10 days).

---

## 1. Transaction Timeout Fix

### Issue
The exam update endpoint was failing with:
```
Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5057 ms passed since the start of the transaction.
```

### Solution
Increased the Prisma transaction timeout from **5000ms to 10000ms** when replacing exam questions:

**File:** `backend/src/controllers/exams.js` (Line 214)

```javascript
const result = await prisma.$transaction(async (tx) => {
  // ... delete and recreate questions ...
}, { timeout: 10000 });  // ← Increased from default 5000ms
```

**Why:** Deleting all questions and recreating them with choices takes more than 5 seconds for large exams.

---

## 2. Exam Visibility Date Range Feature

### Database Schema Changes

Two new optional fields added to `ExamSchedule` model:

```prisma
model ExamSchedule {
  // ... existing fields ...
  
  visibilityStartDate String?  @map("visibility_start_date")  // YYYY-MM-DD
  visibilityEndDate   String?  @map("visibility_end_date")    // YYYY-MM-DD
  
  // Registration dates (independent from visibility)
  registrationOpenDate  String?  @map("registration_open_date")
  registrationCloseDate String?  @map("registration_close_date")
}
```

**Field Meanings:**
- `visibilityStartDate`: When the exam becomes visible to students
- `visibilityEndDate`: When the exam stops being visible to students
- Both are **optional** — if not set, exam is visible based on other criteria

**Example Use Case (10-day visibility):**
- Exam scheduled: April 15, 2026
- Set `visibilityStartDate` = April 1, 2026
- Set `visibilityEndDate` = April 10, 2026
- Result: Exam only visible to students between April 1–10, not on or after April 11

---

## 3. Student Exam Viewing Flow

### Step 1: Student Requests Available Exams

**Endpoint:** `GET /api/exams/schedules/available`

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  https://api.gk-school.com/api/exams/schedules/available
```

### Step 2: Backend Filtering Logic

**File:** `backend/src/controllers/examSchedules.js` (Line 124–137)

The system applies cascading filters:

```javascript
const schedules = await prisma.examSchedule.findMany({
  where: {
    scheduledDate: { gte: today },           // ← Future dates only
    exam: { isActive: true, ...gradeFilter }, // ← Active exams matching grade
  },
  include: { exam: { select: { title: true, gradeLevel: true } } },
  orderBy: { scheduledDate: 'asc' },
});

// In-memory filtering:
const available = schedules.filter(s => {
  if (s.slotsTaken >= s.maxSlots) return false;           // ← Slots exhausted
  
  // Visibility window check (NEW)
  if (s.visibilityStartDate && today < s.visibilityStartDate) return false;
  if (s.visibilityEndDate && today > s.visibilityEndDate) return false;
  
  // Registration window check
  if (s.registrationOpenDate && today < s.registrationOpenDate) return false;
  if (s.registrationCloseDate && today > s.registrationCloseDate) return false;
  
  return true;
});
```

### Step 3: Response Structure

**Response:**
```json
[
  {
    "id": 42,
    "examId": 5,
    "scheduledDate": "2026-04-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "visibilityStartDate": "2026-04-01",
    "visibilityEndDate": "2026-04-10",
    "registrationOpenDate": "2026-03-25",
    "registrationCloseDate": "2026-04-14",
    "maxSlots": 50,
    "slotsTaken": 12,
    "venue": "Main Hall",
    "exam": {
      "title": "Grade 10 Mathematics Final",
      "gradeLevel": "Grade 10"
    }
  }
]
```

### Step 4: Student UI Display

**Frontend File:** `frontend-ts/src/pages/student/ExamSchedule.tsx`

The UI renders available exams with:
- Exam title and date
- Registration deadline countdown
- "Book Exam" button (if slots available and registration open)
- Visibility status indicator (if approaching visibility end date)

**Example Status Messages:**
- ✅ "Available for registration until April 14"
- ⚠️ "Visible until April 10 — register soon!"  
- ❌ "This exam is no longer visible" (if outside visibility window)

---

## 4. Key Features and Constraints

### Visibility vs Registration Windows

| Scenario | Visibility | Registration | Student Sees? | Can Register? |
|----------|-----------|--------------|---------------|---------------|
| Before visibility start | ✗ | ✓ | ❌ No | N/A |
| Visibility open, registration closed | ✓ | ✗ | ✅ Yes | ❌ No |
| Both open | ✓ | ✓ | ✅ Yes | ✅ Yes |
| After visibility end | ✗ | — | ❌ No | N/A |

### Automatic Behavior

When creating an exam schedule, visibility dates are **optional**:
- If `visibilityStartDate` is not set → Exam visible from `scheduledDate` onward
- If `visibilityEndDate` is not set → Exam visible indefinitely (or until `scheduledDate` passes)

### Recommended Defaults

For a **10-day visibility window**:
1. `visibilityStartDate`: Date when you want to announce the exam (typically 2+ weeks before)
2. `visibilityEndDate`: `visibilityStartDate + 10 days` or day before `scheduledDate`

---

## 5. API Endpoints

### Create Schedule with Visibility Dates

**POST `/api/exams/schedules`**

```bash
curl -X POST https://api.gk-school.com/api/exams/schedules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "examId": 5,
    "scheduledDate": "2026-04-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "visibilityStartDate": "2026-04-01",
    "visibilityEndDate": "2026-04-10",
    "registrationOpenDate": "2026-03-25",
    "registrationCloseDate": "2026-04-14",
    "maxSlots": 50,
    "venue": "Main Hall"
  }'
```

### Update Schedule Visibility Dates

**PUT `/api/exams/schedules/:id`**

```bash
curl -X PUT https://api.gk-school.com/api/exams/schedules/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "visibilityStartDate": "2026-04-02",
    "visibilityEndDate": "2026-04-12"
  }'
```

---

## 6. Implementation Checklist

- [x] Increased transaction timeout to 10s
- [x] Added `visibilityStartDate` and `visibilityEndDate` to ExamSchedule model
- [x] Updated `getAvailableSchedules()` filtering logic
- [x] Updated `createSchedule()` to accept visibility dates
- [x] Updated `updateSchedule()` to modify visibility dates
- [x] Generated Prisma client
- [x] Database migration applied (prisma migrate reset)

---

## 7. Testing the Feature

### Test Case 1: Visibility Window Active

**Setup:**
- Today: April 5, 2026
- Exam visibility: April 1–10
- Registration: March 25– April 14

**Expected:** Exam appears in available schedules ✅

### Test Case 2: Before Visibility Window

**Setup:**
- Today: March 20, 2026
- Exam visibility: April 1–10

**Expected:** Exam does NOT appear ✅

### Test Case 3: After Visibility Window

**Setup:**
- Today: April 15, 2026
- Exam visibility: April 1–10

**Expected:** Exam does NOT appear ✅

### Test Case 4: No Visibility Dates

**Setup:**
- Visibility dates: null
- Scheduled date: April 15

**Expected:** Exam visible if today <= April 15 ✅

---

## 8. Frontend Integration (Next Steps)

### Component Updates Needed:
- Display visibility countdown in exam booking UI
- Show warning tooltip when approaching visibility end date
- Add admin panel for editing visibility dates

### Example Component: `ExamBookingCard.tsx`

```typescript
const isWithinVisibility = (schedule: ExamSchedule) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (schedule.visibilityStartDate && today < schedule.visibilityStartDate) {
    return false; // Not yet visible
  }
  if (schedule.visibilityEndDate && today > schedule.visibilityEndDate) {
    return false; // No longer visible
  }
  return true;
};

// In render:
{isWithinVisibility(schedule) ? (
  <button onClick={handleBook}>Book Exam</button>
) : (
  <p className="text-gray-500">This exam is not currently available</p>
)}
```

---

## 9. Troubleshooting

### Error: Transaction Timeout
**Solution:** The timeout is now 10 seconds. If still occurring with large exams:
- Consider batch processing questions (delete in chunks)
- Or increase timeout further

### Error: Visibility Dates Not Working
**Solution:** 
1. Verify Prisma client was regenerated: `npx prisma generate`
2. Verify database has new columns: `npx prisma db push`
3. Check that dates are in YYYY-MM-DD format

### Missing Visibility Fields in Response
**Solution:** Clear browser cache and ensure frontend is using updated API contract

---

## 10. Future Enhancements

- [ ] Bulk schedule visibility updates
- [ ] Automated visibility schedule (set once, auto-repeat yearly)
- [ ] Student notifications when exams become visible
- [ ] Admin dashboard visibility analytics
