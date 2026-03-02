# REST API Specification

## GOLDEN KEY Integrated School of St. Joseph — Admission & Examination System

**Version:** 1.0  
**Date:** February 27, 2026  
**Base URL:** `https://api.goldenkey.edu` (production) / `http://localhost:3001` (development)  

---

## 1. General Conventions

### 1.1 Authentication
All endpoints except `/api/auth/login` and `/api/auth/register` require a valid JWT token:

```
Authorization: Bearer <access_token>
```

### 1.2 Response Format

**Success:**
```json
{
  "data": { ... },
  "message": "Success"
}
```

**Error:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "status": 400,
    "details": {}
  }
}
```

### 1.3 Pagination
List endpoints support pagination via query parameters:

```
GET /api/admissions?page=1&limit=10&sort=submittedAt&order=desc
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 85,
    "totalPages": 9
  }
}
```

### 1.4 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK — request successful |
| 201  | Created — resource created |
| 400  | Bad Request — validation error |
| 401  | Unauthorized — missing/invalid token |
| 403  | Forbidden — insufficient permissions |
| 404  | Not Found — resource not found |
| 409  | Conflict — duplicate/conflicting resource |
| 422  | Unprocessable Entity — business rule violation |
| 500  | Internal Server Error |

---

## 2. Authentication Endpoints

### 2.1 POST `/api/auth/register`

Register a new applicant account.

**Access:** Public

**Request Body:**
```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria@email.com",
  "password": "student123"
}
```

**Validation:**
- `firstName`: required, 1–100 chars
- `lastName`: required, 1–100 chars
- `email`: required, valid email format, unique
- `password`: required, min 8 chars

**Response (201):**
```json
{
  "data": {
    "id": 5,
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria@email.com",
    "role": "applicant",
    "status": "Active"
  },
  "message": "Account created successfully."
}
```

**Errors:**
- `409` — Email already registered

---

### 2.2 POST `/api/auth/login`

Authenticate user and receive tokens.

**Access:** Public

**Request Body:**
```json
{
  "email": "admin@goldenkey.edu",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "data": {
    "user": {
      "id": 1,
      "firstName": "Admin",
      "lastName": "Staff",
      "email": "admin@goldenkey.edu",
      "role": "administrator",
      "status": "Active"
    },
    "accessToken": "eyJhbGciOi...",
    "expiresIn": 900
  },
  "message": "Login successful."
}
```

*Refresh token set as `httpOnly` cookie.*

**Errors:**
- `401` — Invalid credentials
- `403` — Account inactive

---

### 2.3 POST `/api/auth/refresh`

Get new access token using refresh token cookie.

**Access:** Public (requires valid refresh cookie)

**Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOi...",
    "expiresIn": 900
  }
}
```

---

### 2.4 POST `/api/auth/logout`

Clear refresh token cookie.

**Access:** Authenticated

**Response (200):**
```json
{ "message": "Logged out." }
```

---

### 2.5 POST `/api/auth/forgot-password`

Request a password reset link (sends email).

**Access:** Public

**Request Body:**
```json
{ "email": "user@email.com" }
```

**Response (200):**
```json
{ "message": "If an account exists with that email, a reset link has been sent." }
```

---

### 2.6 POST `/api/auth/reset-password`

Reset password using a token.

**Access:** Public

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{ "message": "Password reset successfully." }
```

---

## 3. Admission Endpoints

### 3.1 GET `/api/admissions`

List admissions with filters.

**Access:** Admin, Registrar (all); Applicant (own only)

**Query Parameters:**
| Param   | Type   | Default  | Description |
|---------|--------|----------|-------------|
| page    | int    | 1        | Page number |
| limit   | int    | 10       | Items per page |
| search  | string | —        | Search by name/email |
| status  | string | —        | Filter by status |
| grade   | string | —        | Filter by grade level |
| sort    | string | submittedAt | Sort field |
| order   | string | desc     | Sort direction (asc/desc) |

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "firstName": "Maria",
      "lastName": "Santos",
      "email": "maria.santos@email.com",
      "phone": "+63 912 345 6789",
      "gradeLevel": "Grade 7",
      "applicantType": "New",
      "status": "Accepted",
      "submittedAt": "2026-02-18T09:30:00Z",
      "documentsCount": 6
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 6, "totalPages": 1 }
}
```

---

### 3.2 GET `/api/admissions/:id`

Get single admission with full details.

**Access:** Admin, Registrar; Applicant (own only)

**Response (200):**
```json
{
  "data": {
    "id": 1,
    "userId": 3,
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria.santos@email.com",
    "phone": "+63 912 345 6789",
    "dob": "2010-05-14",
    "gender": "Female",
    "address": "123 Rizal St, San Jose, Batangas",
    "gradeLevel": "Grade 7",
    "prevSchool": "Manila Elementary School",
    "schoolYear": "2026-2027",
    "lrn": "123456789012",
    "applicantType": "New",
    "guardian": "Elena Santos",
    "guardianRelation": "Mother",
    "guardianPhone": "+63 912 000 1111",
    "guardianEmail": "elena.santos@email.com",
    "status": "Accepted",
    "notes": "Complete requirements.",
    "submittedAt": "2026-02-18T09:30:00Z",
    "documents": [
      { "id": 1, "documentName": "PSA Birth Certificate" },
      { "id": 2, "documentName": "2x2 ID Photos" }
    ]
  }
}
```

---

### 3.3 POST `/api/admissions`

Submit a new admission application.

**Access:** Applicant only

**Request Body:**
```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria.santos@email.com",
  "phone": "+63 912 345 6789",
  "dob": "2010-05-14",
  "gender": "Female",
  "address": "123 Rizal St, San Jose, Batangas",
  "gradeLevel": "Grade 7",
  "prevSchool": "Manila Elementary School",
  "schoolYear": "2026-2027",
  "lrn": "123456789012",
  "applicantType": "New",
  "guardian": "Elena Santos",
  "guardianRelation": "Mother",
  "guardianPhone": "+63 912 000 1111",
  "guardianEmail": "elena.santos@email.com",
  "documents": ["PSA Birth Certificate", "2x2 ID Photos", "Report Card / Form 138"]
}
```

**Validation:**
- All required fields per Admission model
- LRN: 12 digits only (if provided)
- Phone: valid format
- Grade-appropriate age check
- No existing active application for this user

**Response (201):**
```json
{
  "data": { "id": 7, "status": "Submitted", "submittedAt": "2026-02-27T..." },
  "message": "Application submitted successfully."
}
```

**Errors:**
- `409` — User already has an active application

---

### 3.4 PATCH `/api/admissions/:id/status`

Update admission status.

**Access:** Admin, Registrar

**Request Body:**
```json
{
  "status": "Under Screening",
  "notes": "Documents look complete."
}
```

**Validation:**
- Status must be a valid transition from current status (see Business Rules)

**Valid Transitions:**
| From              | Allowed To |
|-------------------|-----------|
| Submitted         | Under Screening, Rejected |
| Under Screening   | Under Evaluation, Rejected |
| Under Evaluation  | Pending Payment, Rejected |
| Pending Payment   | Accepted, Rejected |
| Rejected          | Submitted |
| Accepted          | *(none — terminal)* |

**Response (200):**
```json
{
  "data": { "id": 1, "status": "Under Screening", "notes": "Documents look complete." },
  "message": "Status updated."
}
```

**Errors:**
- `422` — Invalid status transition

---

### 3.5 PATCH `/api/admissions/bulk-status`

Bulk update admission statuses.

**Access:** Admin, Registrar

**Request Body:**
```json
{
  "ids": [1, 2, 3],
  "status": "Under Screening"
}
```

**Response (200):**
```json
{
  "data": { "updated": 3, "failed": 0 },
  "message": "3 application(s) updated."
}
```

---

### 3.6 GET `/api/admissions/stats`

Get admission statistics.

**Access:** Admin, Registrar

**Response (200):**
```json
{
  "data": {
    "total": 6,
    "submitted": 1,
    "underScreening": 1,
    "underEvaluation": 1,
    "pendingPayment": 1,
    "accepted": 1,
    "rejected": 1
  }
}
```

---

## 4. Exam Endpoints

### 4.1 GET `/api/exams`

List all exams.

**Access:** Admin, Exam Coordinator (all); Applicant (active exams matching their grade)

**Query Parameters:**
| Param      | Type   | Description |
|------------|--------|-------------|
| gradeLevel | string | Filter by grade |
| isActive   | bool   | Filter by active status |
| search     | string | Search by title |

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Entrance Exam — Grade 7-10",
      "gradeLevel": "Grade 7-10",
      "durationMinutes": 60,
      "passingScore": 60,
      "isActive": true,
      "questionsCount": 10
    }
  ]
}
```

---

### 4.2 GET `/api/exams/:id`

Get exam details (with questions for authorized users).

**Access:** Admin, Exam Coordinator (full); Applicant (during active exam only — no correct answers exposed)

**Response (200):**
```json
{
  "data": {
    "id": 1,
    "title": "Entrance Exam — Grade 7-10",
    "gradeLevel": "Grade 7-10",
    "durationMinutes": 60,
    "passingScore": 60,
    "isActive": true,
    "questions": [
      {
        "id": 1,
        "questionText": "What is the capital of the Philippines?",
        "questionType": "mc",
        "points": 5,
        "orderNum": 1,
        "choices": [
          { "id": 1, "choiceText": "Cebu" },
          { "id": 2, "choiceText": "Manila" },
          { "id": 3, "choiceText": "Davao" },
          { "id": 4, "choiceText": "Quezon City" }
        ]
      }
    ]
  }
}
```

*Note: `isCorrect` is only included for Admin/Exam Coordinator — never for Applicants.*

---

### 4.3 POST `/api/exams`

Create a new exam.

**Access:** Admin, Exam Coordinator

**Request Body:**
```json
{
  "title": "Entrance Exam — Grade 7-10",
  "gradeLevel": "Grade 7-10",
  "durationMinutes": 60,
  "passingScore": 60,
  "questions": [
    {
      "questionText": "What is the capital of the Philippines?",
      "questionType": "mc",
      "points": 5,
      "orderNum": 1,
      "choices": [
        { "choiceText": "Cebu", "isCorrect": false },
        { "choiceText": "Manila", "isCorrect": true },
        { "choiceText": "Davao", "isCorrect": false },
        { "choiceText": "Quezon City", "isCorrect": false }
      ]
    }
  ]
}
```

**Response (201):**
```json
{
  "data": { "id": 3 },
  "message": "Exam created."
}
```

---

### 4.4 PUT `/api/exams/:id`

Update an existing exam.

**Access:** Admin, Exam Coordinator

*(Same body format as POST)*

---

### 4.5 DELETE `/api/exams/:id`

Delete an exam (cascade: schedules, registrations, results).

**Access:** Admin, Exam Coordinator

**Response (200):**
```json
{ "message": "Exam and related data deleted." }
```

---

## 5. Exam Schedule Endpoints

### 5.1 GET `/api/exam-schedules`

List exam schedules.

**Access:** All authenticated users

**Query Parameters:**
| Param  | Type | Description |
|--------|------|-------------|
| examId | int  | Filter by exam |

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "examId": 1,
      "examTitle": "Entrance Exam — Grade 7-10",
      "scheduledDate": "2026-03-05",
      "startTime": "09:00",
      "endTime": "10:00",
      "maxSlots": 30,
      "slotsTaken": 12,
      "slotsAvailable": 18
    }
  ]
}
```

---

### 5.2 POST `/api/exam-schedules`

Create a new exam schedule.

**Access:** Admin, Exam Coordinator

**Request Body:**
```json
{
  "examId": 1,
  "scheduledDate": "2026-03-20",
  "startTime": "09:00",
  "endTime": "10:00",
  "maxSlots": 30,
  "venue": "Room 101"
}
```

---

### 5.3 PUT `/api/exam-schedules/:id`

Update a schedule.

**Access:** Admin, Exam Coordinator

---

### 5.4 DELETE `/api/exam-schedules/:id`

Delete a schedule (cascade: registrations, results).

**Access:** Admin, Exam Coordinator

---

## 6. Exam Registration Endpoints

### 6.1 GET `/api/exam-registrations`

List registrations.

**Access:** Admin, Exam Coordinator (all); Applicant (own only)

---

### 6.2 POST `/api/exam-registrations`

Book an exam slot.

**Access:** Applicant only

**Request Body:**
```json
{
  "admissionId": 1,
  "scheduleId": 1
}
```

**Validation:**
- Admission must have eligible status (Under Screening, Under Evaluation, Pending Payment)
- No duplicate registration for same applicant
- Schedule must have available slots

**Response (201):**
```json
{
  "data": { "id": 3, "status": "scheduled" },
  "message": "Exam slot booked."
}
```

**Errors:**
- `409` — Already registered
- `422` — Not eligible / Schedule full

---

### 6.3 POST `/api/exam-registrations/:id/start`

Start an exam (record `startedAt`).

**Access:** Applicant (own registration only)

**Response (200):**
```json
{
  "data": {
    "registrationId": 1,
    "status": "started",
    "startedAt": "2026-03-05T09:02:00Z",
    "exam": { "questions": [...], "durationMinutes": 60 }
  }
}
```

*Questions are returned WITHOUT `isCorrect` flags.*

---

## 7. Results Endpoints

### 7.1 GET `/api/results`

List all exam results.

**Access:** Admin, Exam Coordinator (all); Applicant (own only)

**Query Parameters:**
| Param        | Type   | Description |
|--------------|--------|-------------|
| examId       | int    | Filter by exam |
| passed       | bool   | Filter by pass/fail |
| essayReviewed| bool   | Filter by essay review status |
| search       | string | Search by student name |

---

### 7.2 POST `/api/results/submit`

Submit exam answers and get auto-scored MC results.

**Access:** Applicant (own registration only)

**Request Body:**
```json
{
  "registrationId": 1,
  "answers": {
    "1": 2,
    "2": 6,
    "10": "Education is the foundation..."
  }
}
```

*Keys are question IDs; values are choice IDs (MC) or text (essay).*

**Response (200):**
```json
{
  "data": {
    "totalScore": 40,
    "maxPossible": 60,
    "percentage": 66.7,
    "passed": false,
    "essayReviewed": false,
    "message": "Exam submitted. Essay answers are pending review."
  }
}
```

---

### 7.3 GET `/api/results/essays`

List all essay answers.

**Access:** Admin, Exam Coordinator

**Query Parameters:**
| Param  | Type | Description |
|--------|------|-------------|
| scored | bool | Filter by scored status |

---

### 7.4 PATCH `/api/results/essays/:id/score`

Score an essay answer.

**Access:** Admin, Exam Coordinator

**Request Body:**
```json
{
  "pointsAwarded": 12
}
```

**Validation:**
- `pointsAwarded` must be 0 ≤ value ≤ maxPoints

**Side Effects:**
- Recalculates total score, percentage, and pass/fail for the registration
- If all essays for a registration are scored, sets `essayReviewed = true`
- Sends notification to student

**Response (200):**
```json
{
  "data": {
    "id": 1,
    "pointsAwarded": 12,
    "scored": true,
    "updatedResult": {
      "totalScore": 52,
      "percentage": 86.7,
      "passed": true,
      "essayReviewed": true
    }
  },
  "message": "Essay scored."
}
```

---

## 8. User Endpoints

### 8.1 GET `/api/users`

List all users.

**Access:** Admin only

**Query Parameters:**
| Param  | Type   | Description |
|--------|--------|-------------|
| role   | string | Filter by role |
| status | string | Filter by status |
| search | string | Search by name/email |

---

### 8.2 GET `/api/users/:id`

Get user details.

**Access:** Admin (any user); Authenticated user (own profile)

---

### 8.3 POST `/api/users`

Create a new user.

**Access:** Admin only

**Request Body:**
```json
{
  "firstName": "New",
  "lastName": "User",
  "email": "new@goldenkey.edu",
  "password": "password123",
  "role": "registrar",
  "status": "Active"
}
```

---

### 8.4 PUT `/api/users/:id`

Update a user.

**Access:** Admin only

*Password field is optional — if omitted, password remains unchanged.*

---

### 8.5 DELETE `/api/users/:id`

Delete a user.

**Access:** Admin only

**Validation:**
- Cannot delete own account

**Errors:**
- `422` — Cannot delete yourself

---

## 9. Notification Endpoints

### 9.1 GET `/api/notifications`

Get current user's notifications.

**Access:** Authenticated (own notifications only)

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "type": "admission",
      "title": "Application Received",
      "message": "Your admission application has been received.",
      "isRead": true,
      "createdAt": "2026-02-23T10:05:00Z"
    }
  ]
}
```

---

### 9.2 GET `/api/notifications/unread-count`

Get unread notification count.

**Access:** Authenticated

**Response (200):**
```json
{ "data": { "count": 3 } }
```

---

### 9.3 PATCH `/api/notifications/:id/read`

Mark a single notification as read.

**Access:** Authenticated (own only)

---

### 9.4 PATCH `/api/notifications/read-all`

Mark all notifications as read.

**Access:** Authenticated (own only)

---

## 10. Reports Endpoints

### 10.1 GET `/api/reports/admissions`

Get admission report data.

**Access:** Admin, Registrar

**Response (200):**
```json
{
  "data": {
    "stats": { "total": 6, "submitted": 1, "accepted": 1 },
    "byGrade": [{ "grade": "Grade 7", "count": 1 }],
    "byStatus": [{ "status": "Accepted", "count": 1 }],
    "byMonth": [{ "month": "2026-02", "count": 6 }]
  }
}
```

---

### 10.2 GET `/api/reports/exams`

Get exam performance report data.

**Access:** Admin, Exam Coordinator

---

### 10.3 GET `/api/reports/export/admissions`

Export admissions as CSV.

**Access:** Admin, Registrar

**Response:** `Content-Type: text/csv`

---

### 10.4 GET `/api/reports/export/results`

Export exam results as CSV.

**Access:** Admin, Exam Coordinator

**Response:** `Content-Type: text/csv`

---

## 11. Frontend → Backend Migration Mapping

Maps current `src/api/*.js` functions to REST endpoints:

| Current Function              | HTTP Method | Endpoint                          |
|-------------------------------|-------------|-----------------------------------|
| `getAdmissions()`             | GET         | `/api/admissions`                 |
| `getAdmission(id)`           | GET         | `/api/admissions/:id`             |
| `addAdmission(data)`         | POST        | `/api/admissions`                 |
| `updateAdmissionStatus(id,..)` | PATCH     | `/api/admissions/:id/status`      |
| `getStats()`                  | GET         | `/api/admissions/stats`           |
| `getExams()`                  | GET         | `/api/exams`                      |
| `getExam(id)`                | GET         | `/api/exams/:id`                  |
| `addExam(data)`              | POST        | `/api/exams`                      |
| `updateExam(id, data)`       | PUT         | `/api/exams/:id`                  |
| `deleteExam(id)`             | DELETE      | `/api/exams/:id`                  |
| `getExamSchedules(examId)`   | GET         | `/api/exam-schedules?examId=`     |
| `addExamSchedule(data)`      | POST        | `/api/exam-schedules`             |
| `updateExamSchedule(id,..)` | PUT         | `/api/exam-schedules/:id`         |
| `deleteExamSchedule(id)`     | DELETE      | `/api/exam-schedules/:id`         |
| `getExamRegistrations()`     | GET         | `/api/exam-registrations`         |
| `registerForExam(appId, schedId)` | POST  | `/api/exam-registrations`         |
| `startExam(regId)`           | POST        | `/api/exam-registrations/:id/start` |
| `getExamResults()`           | GET         | `/api/results`                    |
| `getExamResult(regId)`       | GET         | `/api/results?registrationId=`    |
| `submitExamAnswers(..)`      | POST        | `/api/results/submit`             |
| `getEssayAnswers()`          | GET         | `/api/results/essays`             |
| `scoreEssay(id, points)`    | PATCH       | `/api/results/essays/:id/score`   |
| `getSubmittedAnswers(regId)` | GET         | `/api/results/answers/:regId`     |
| `getUsers()`                 | GET         | `/api/users`                      |
| `addUser(data)`              | POST        | `/api/users`                      |
| `updateUser(id, data)`       | PUT         | `/api/users/:id`                  |
| `deleteUser(id)`             | DELETE      | `/api/users/:id`                  |
| `getUserByEmail(email)`      | GET         | `/api/users?email=` (internal)    |
| `getNotifications(userId)`   | GET         | `/api/notifications`              |
| `getUnreadCount(userId)`     | GET         | `/api/notifications/unread-count` |
| `markNotificationRead(id)`   | PATCH       | `/api/notifications/:id/read`     |
| `markAllRead(userId)`        | PATCH       | `/api/notifications/read-all`     |
| `addNotification(data)`      | *(internal — server creates automatically)* | |
