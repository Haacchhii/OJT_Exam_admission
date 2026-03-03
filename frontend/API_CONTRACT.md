# Golden Key — Backend API Contract

> This document lists every endpoint the React frontend expects.  
> Implement these on your backend server and set `VITE_API_URL` in `.env` to enable API mode.

---

## Authentication

All endpoints (except `POST /auth/*`) require a `Bearer` token in the `Authorization` header.  
On **401**, the frontend auto-clears the token and redirects to login.

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| `POST` | `/auth/login` | `{ email, password }` | `{ user, token }` | `user` must **not** contain `password`. `token` is a JWT. |
| `POST` | `/auth/register` | `{ firstName, lastName, email, password }` | `{ user, token }` | Creates an `applicant` user. |

### User Object Shape (returned in `user` field)

```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "role": "applicant",
  "status": "Active",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

**Roles**: `administrator`, `registrar`, `teacher`, `applicant`

---

## Admissions

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/admissions` | `status`, `grade`, `search`, `sort`, `page`, `limit` | — | `Admission[]` (paginated — see Pagination) |
| `GET` | `/admissions/mine` | — | — | `Admission \| null` (current user's own application) |
| `GET` | `/admissions/:id` | — | — | `Admission` |
| `GET` | `/admissions/stats` | `grade`, `from`, `to` | — | `{ total, submitted, underScreening, underEvaluation, accepted, rejected }` |
| `POST` | `/admissions` | — | Admission payload | `Admission` (with generated `id`, `status: 'Submitted'`, `submittedAt`) |
| `POST` | `/admissions/:id/documents` | — | `multipart/form-data` with field `documents` (multiple files) | `{ urls: string[] }` |
| `PATCH` | `/admissions/:id/status` | — | `{ status, notes? }` | `Admission` |
| `PATCH` | `/admissions/bulk-status` | — | `{ ids: number[], status: string }` | `{ updated: number }` |

### Admission Object Shape

```json
{
  "id": 1,
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria@example.com",
  "phone": "09171234567",
  "dob": "2012-05-15",
  "gender": "Female",
  "address": "123 Main St, San Jose, Batangas",
  "guardian": "Juan Santos",
  "guardianRelation": "Father",
  "guardianPhone": "09181234567",
  "guardianEmail": "juan@example.com",
  "gradeLevel": "Grade 7",
  "prevSchool": "San Jose Elementary",
  "schoolYear": "2026-2027",
  "lrn": "123456789012",
  "applicantType": "New Student",
  "documents": ["PSA Birth Certificate", "Report Card"],
  "status": "Submitted",
  "notes": "",
  "submittedAt": "2026-03-01T08:00:00.000Z"
}
```

### Valid Status Transitions

```
Submitted → Under Screening, Rejected
Under Screening → Under Evaluation, Rejected
Under Evaluation → Accepted, Rejected
Rejected → Submitted  (re-apply)
Accepted → (terminal)
```

### Business Rules (backend must enforce)
- **Exam-first gate**: A student must have a **passing** exam result before `POST /admissions` is allowed.
- **Transition guard**: `PATCH /admissions/:id/status` must validate against the transition map above.
- **File upload**: `POST /admissions/:id/documents` should store files and return public URLs.

---

## Exams

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/exams` | `search`, `grade`, `status`, `page`, `limit` | — | `Exam[]` |
| `GET` | `/exams/:id` | — | — | `Exam` (with full questions including `isCorrect`) |
| `GET` | `/exams/:id/student` | — | — | `Exam` (**without** `isCorrect` on choices — safe for students) |
| `POST` | `/exams` | — | Exam payload | `Exam` (with generated `id`) |
| `PUT` | `/exams/:id` | — | Exam payload (partial OK) | `Exam` |
| `DELETE` | `/exams/:id` | — | — | `204 No Content` (cascade: delete schedules, registrations, results) |

### Exam Object Shape

```json
{
  "id": 1,
  "title": "Grade 7-10 Entrance Exam",
  "gradeLevel": "Grade 7-10",
  "durationMinutes": 60,
  "passingScore": 60,
  "isActive": true,
  "createdBy": "Admin",
  "questions": [
    {
      "id": "uuid-1",
      "questionText": "What is 2+2?",
      "questionType": "mc",
      "points": 5,
      "orderNum": 1,
      "choices": [
        { "id": "uuid-c1", "choiceText": "3", "isCorrect": false },
        { "id": "uuid-c2", "choiceText": "4", "isCorrect": true }
      ]
    },
    {
      "id": "uuid-2",
      "questionText": "Explain photosynthesis.",
      "questionType": "essay",
      "points": 10,
      "orderNum": 2,
      "choices": []
    }
  ]
}
```

**Note on `/exams/:id/student`**: Same shape but every `choice.isCorrect` field must be **omitted or always `false`** to prevent answer leaking. Only return this after the student has started or completed the exam.

---

## Exam Schedules

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/exams/schedules` | `examId`, `search`, `page`, `limit` | — | `Schedule[]` |
| `GET` | `/exams/schedules/available` | — | — | `Schedule[]` (only active exam schedules with remaining slots, future dates) |
| `POST` | `/exams/schedules` | — | Schedule payload | `Schedule` (with `slotsTaken: 0`) |
| `PUT` | `/exams/schedules/:id` | — | Schedule payload | `Schedule` |
| `DELETE` | `/exams/schedules/:id` | — | — | `204` (cascade: delete registrations, results) |

### Schedule Object

```json
{
  "id": 1,
  "examId": 1,
  "scheduledDate": "2026-04-01",
  "startTime": "09:00",
  "endTime": "11:00",
  "maxSlots": 30,
  "slotsTaken": 12
}
```

---

## Exam Registrations

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/exams/registrations` | `search`, `status`, `page`, `limit` | — | `Registration[]` |
| `GET` | `/exams/registrations/mine` | — | — | `Registration[]` (current user's registrations only) |
| `POST` | `/exams/registrations` | — | `{ userEmail, scheduleId }` | `Registration` (or `null` / error if duplicate or full) |
| `PATCH` | `/exams/registrations/:id/start` | — | — | `Registration` (sets `status: 'started'`, `startedAt`) |

### Registration Object

```json
{
  "id": 1,
  "userEmail": "student@example.com",
  "scheduleId": 3,
  "status": "scheduled",
  "startedAt": null,
  "submittedAt": null
}
```

**Status values**: `scheduled` → `started` → `done`

### Business Rules
- One active registration per student (status ≠ `done`).
- `slotsTaken` increments on registration.
- **Time enforcement**: Backend should validate that the current time is within the schedule window before allowing `start`.
- **Duration enforcement**: Backend should auto-submit if `durationMinutes` has elapsed since `startedAt`.

---

## Results

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/results` | `search`, `passed`, `examId`, `page`, `limit` | — | `Result[]` |
| `GET` | `/results/mine` | — | — | `Result \| null` (current user's result) |
| `GET` | `/results/:registrationId` | — | — | `Result` |
| `GET` | `/results/answers/:registrationId` | — | — | `SubmittedAnswer[]` |
| `GET` | `/results/essays` | `status` (`pending`/`scored`/`all`), `page`, `limit` | — | `EssayAnswer[]` |
| `POST` | `/results/submit` | — | `{ registrationId, answers }` | `{ totalScore, maxPossible, percentage, passed }` |
| `PATCH` | `/results/essays/:answerId/score` | — | `{ points }` | `EssayAnswer` |

### Result Object

```json
{
  "id": 1,
  "registrationId": 1,
  "totalScore": 45,
  "maxPossible": 60,
  "percentage": 75.0,
  "passed": true,
  "essayReviewed": false,
  "reviewedBy": null,
  "createdAt": "2026-03-15T10:00:00.000Z"
}
```

### Answers Payload (`POST /results/submit`)

```json
{
  "registrationId": 1,
  "answers": {
    "uuid-q1": "uuid-choice-2",
    "uuid-q2": "This is my essay answer..."
  }
}
```

> **SECURITY**: The backend MUST look up exam questions from its own database.  
> The `answers` object only contains `{ questionId: choiceId | essayText }`.  
> Do NOT accept a `questions` array from the client.

### Essay Answer Object

```json
{
  "id": 1,
  "registrationId": 1,
  "questionId": "uuid-2",
  "essayResponse": "Photosynthesis is the process...",
  "pointsAwarded": null,
  "maxPoints": 10,
  "scored": false
}
```

### Scoring Business Rules
- `PATCH /results/essays/:id/score` — clamp `points` to `[0, maxPoints]`.
- When **all** essays for a registration are scored, recalculate `totalScore`, `percentage`, `passed`, and set `essayReviewed: true`.
- Notify the student when all essays are reviewed.

---

## Users

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/users` | `search`, `role`, `status`, `page`, `limit` | — | `User[]` |
| `GET` | `/users/:id` | — | — | `User` |
| `GET` | `/users/by-email/:email` | — | — | `User \| null` |
| `POST` | `/users` | — | `{ firstName, lastName, email, role, status, password }` | `User` |
| `PUT` | `/users/:id` | — | User fields (password optional) | `User` |
| `DELETE` | `/users/:id` | — | — | `204` (cascade: delete admissions, registrations, results, notifications) |

### Business Rules
- **Password**: Backend must **hash** the password. Never store or return plaintext.
- **Email uniqueness**: Enforce at DB level.
- **Cascade delete**: Removing a user should remove all associated data.

---

## Notifications

| Method | Path | Query Params | Body | Response |
|--------|------|-------------|------|----------|
| `GET` | `/notifications/:userId` | `page`, `limit` | — | `Notification[]` |
| `GET` | `/notifications/:userId/unread-count` | — | — | `{ count: number }` |
| `PATCH` | `/notifications/:id/read` | — | — | `204` |
| `PATCH` | `/notifications/:userId/read-all` | — | — | `204` |
| `POST` | `/notifications` | — | `{ userId, title, message, type }` | `Notification` |

### Notification Object

```json
{
  "id": 1,
  "userId": "student_3",
  "title": "Application Submitted",
  "message": "Your admission application has been submitted.",
  "type": "info",
  "isRead": false,
  "createdAt": "2026-03-01T08:00:00.000Z"
}
```

**Type values**: `info`, `success`, `warning`, `exam`

**userId convention**:
- Students: `"student_<userId>"` — scoped to individual
- Employees: `"employee"` — shared across all staff

---

## Pagination (standard envelope)

When any list endpoint receives `page` and/or `limit` params, it should return:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 47,
    "totalPages": 5
  }
}
```

If pagination params are omitted, the endpoint may return a flat array for backward compatibility.

---

## Error Responses

All errors should return JSON:

```json
{
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error / bad request |
| `401` | Not authenticated (triggers auto-logout) |
| `403` | Forbidden (role doesn't have permission) |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate email) |
| `422` | Unprocessable entity |
| `500` | Internal server error |

---

## CORS

The backend must allow:
- **Origin**: The frontend URL (e.g., `http://localhost:5173` in dev)
- **Methods**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **Headers**: `Content-Type, Authorization`
- **Credentials**: `true` (if using cookies alongside JWT)

---

## File Upload

`POST /admissions/:id/documents` accepts `multipart/form-data`:
- Field name: `documents` (multiple files)
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- Max file size: 10 MB per file
- Response: `{ urls: ["https://storage.example.com/doc1.pdf", ...] }`

The returned URLs are stored in the admission's `documents` field for display.
