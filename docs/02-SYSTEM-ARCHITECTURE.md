# System Architecture Document

## GOLDEN KEY Integrated School of St. Joseph — Admission & Examination System

**Version:** 1.0  
**Date:** February 27, 2026  

---

## 1. Architecture Overview

The system follows a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT TIER                          │
│                                                          │
│   React 18 SPA (Vite + Tailwind CSS v4)                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│   │  Pages   │ │Components│ │  Context  │               │
│   │(Student/ │ │(UI/Modal/│ │(Auth/     │               │
│   │Employee) │ │Sidebar)  │ │Toast/     │               │
│   └────┬─────┘ └──────────┘ │Confirm)  │               │
│        │                     └──────────┘               │
│   ┌────▼─────────────────────────────────┐              │
│   │         API Service Layer            │              │
│   │ (src/api/*.js — abstraction layer)   │              │
│   └────┬─────────────────────────────────┘              │
│        │  Currently: localStorage                        │
│        │  Target: HTTP fetch() to REST API               │
└────────┼─────────────────────────────────────────────────┘
         │
         │  HTTPS (JSON)
         │
┌────────▼─────────────────────────────────────────────────┐
│                   APPLICATION TIER                         │
│                                                            │
│   Node.js + Express.js                                     │
│   ┌──────────────────────────────────────┐                 │
│   │           Middleware Stack            │                 │
│   │  ┌─────────┐ ┌──────┐ ┌──────────┐  │                 │
│   │  │  CORS   │ │Auth  │ │Validation│  │                 │
│   │  │         │ │(JWT) │ │(Joi/Zod) │  │                 │
│   │  └─────────┘ └──────┘ └──────────┘  │                 │
│   └──────────────────────────────────────┘                 │
│   ┌──────────────────────────────────────┐                 │
│   │           Route Handlers             │                 │
│   │  /api/auth   /api/admissions         │                 │
│   │  /api/exams  /api/results            │                 │
│   │  /api/users  /api/notifications      │                 │
│   └──────────┬───────────────────────────┘                 │
│              │                                             │
│   ┌──────────▼───────────────────────────┐                 │
│   │      ORM / Query Builder             │                 │
│   │      (Prisma or Sequelize)           │                 │
│   └──────────┬───────────────────────────┘                 │
└──────────────┼─────────────────────────────────────────────┘
               │
               │  TCP (SQL)
               │
┌──────────────▼─────────────────────────────────────────────┐
│                     DATA TIER                               │
│                                                              │
│   MySQL 8.0 / PostgreSQL 15+                                │
│   ┌──────────────────────────────────────┐                   │
│   │  users        │ admissions           │                   │
│   │  exams        │ exam_questions       │                   │
│   │  question_choices │ exam_schedules   │                   │
│   │  exam_registrations │ exam_results   │                   │
│   │  essay_answers│ submitted_answers    │                   │
│   │  notifications│ documents            │                   │
│   └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Current Architecture (Frontend-Only)

```
golden-key-react/
├── src/
│   ├── api/                    # Data access abstraction layer
│   │   ├── admissions.js       #   Admission CRUD + status transitions
│   │   ├── exams.js            #   Exam/Schedule/Registration CRUD
│   │   ├── results.js          #   Results, scoring, submitted answers
│   │   ├── users.js            #   User CRUD
│   │   └── notifications.js    #   Notification CRUD
│   │
│   ├── context/
│   │   └── AuthContext.jsx     # Authentication state (login/logout/session)
│   │
│   ├── data/
│   │   ├── seed-data.js        # Default demo data (6 admissions, 2 exams, 4 users)
│   │   └── store.js            # localStorage persistence + caching
│   │
│   ├── components/             # Shared UI components
│   │   ├── UI.jsx              #   StatCard, Badge, Pagination, EmptyState, PageHeader
│   │   ├── Modal.jsx           #   Focus-trapped modal dialog
│   │   ├── ConfirmDialog.jsx   #   Promise-based confirmation dialog
│   │   ├── Toast.jsx           #   Toast notification system
│   │   ├── Sidebar.jsx         #   Navigation sidebar
│   │   ├── Topbar.jsx          #   Top bar with notifications
│   │   ├── Breadcrumbs.jsx     #   Route-based breadcrumbs
│   │   ├── Layout.jsx          #   Student/Employee layout wrappers
│   │   ├── ScrollToTop.jsx     #   Scroll reset on route change
│   │   ├── KeyboardShortcuts.jsx # Global keyboard shortcuts
│   │   └── ErrorBoundary.jsx   #   React error boundary
│   │
│   ├── pages/
│   │   ├── auth/               # Login, Register, Forgot/Reset Password
│   │   ├── student/            # Dashboard, Admission, Exam, Results
│   │   └── employee/           # Dashboard, Admissions, Exams, Results, Reports, Users
│   │
│   ├── hooks/
│   │   └── useUnsavedChanges.js # Navigation guard for unsaved form data
│   │
│   ├── utils/
│   │   └── helpers.js          # Shared utilities (formatDate, formatTime, badgeClass, etc.)
│   │
│   ├── App.jsx                 # Root: HashRouter + Routes
│   └── main.jsx                # Entry point
```

### Key Design Decision: API Abstraction Layer

The `src/api/*.js` files serve as an abstraction boundary. All page components import functions like `getAdmissions()`, `submitExamAnswers()`, etc. — never touching `localStorage` directly. This means **swapping to a REST backend requires changing only these 5 files**, not the 15+ pages/components.

---

## 3. Target Architecture (Full Stack)

### 3.1 Backend Structure

```
golden-key-api/
├── src/
│   ├── config/
│   │   ├── database.js         # DB connection config
│   │   └── env.js              # Environment variable loader
│   │
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   ├── rbac.js             # Role-based access control
│   │   ├── validate.js         # Request body validation (Joi/Zod)
│   │   └── errorHandler.js     # Global error handler
│   │
│   ├── routes/
│   │   ├── auth.routes.js      # POST /login, /register, /refresh-token
│   │   ├── admissions.routes.js
│   │   ├── exams.routes.js
│   │   ├── results.routes.js
│   │   ├── users.routes.js
│   │   └── notifications.routes.js
│   │
│   ├── controllers/            # Route handler logic
│   │   ├── auth.controller.js
│   │   ├── admissions.controller.js
│   │   ├── exams.controller.js
│   │   ├── results.controller.js
│   │   ├── users.controller.js
│   │   └── notifications.controller.js
│   │
│   ├── services/               # Business logic layer
│   │   ├── auth.service.js
│   │   ├── admission.service.js
│   │   ├── exam.service.js
│   │   ├── result.service.js
│   │   ├── user.service.js
│   │   └── notification.service.js
│   │
│   ├── models/                 # Prisma schema or Sequelize models
│   │   └── (managed by ORM)
│   │
│   ├── utils/
│   │   ├── jwt.js              # Token generation & verification
│   │   └── password.js         # bcrypt hashing helpers
│   │
│   └── server.js               # Express app setup & launch
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.js                 # Seed data script
│
├── .env                        # Environment variables
├── package.json
└── README.md
```

### 3.2 Request Flow

```
Client (React) 
  → HTTP Request (with JWT in Authorization header)
    → Express Router
      → Auth Middleware (verify JWT, attach user to req)
        → RBAC Middleware (check role permissions)
          → Validation Middleware (validate request body)
            → Controller (parse request, call service)
              → Service (business logic)
                → ORM / Database Query
                  → MySQL/PostgreSQL
              ← Return result
            ← Format response
          ← Send JSON response
        ← 403 if unauthorized
      ← 401 if unauthenticated
    ← HTTP Response (JSON)
  ← Update React state
```

---

## 4. Authentication Flow

### 4.1 Login

```
Client                           Server                         Database
  │                                │                               │
  │  POST /api/auth/login          │                               │
  │  { email, password }           │                               │
  │ ──────────────────────────────►│                               │
  │                                │  SELECT * FROM users           │
  │                                │  WHERE email = ?               │
  │                                │ ─────────────────────────────►│
  │                                │◄─────────────────────────────│
  │                                │                               │
  │                                │  bcrypt.compare(password,     │
  │                                │    user.passwordHash)          │
  │                                │                               │
  │                                │  Generate JWT:                 │
  │                                │  { userId, role, exp }         │
  │                                │                               │
  │  { token, user }               │                               │
  │◄──────────────────────────────│                               │
  │                                │                               │
  │  Store token in memory         │                               │
  │  Set user in AuthContext       │                               │
```

### 4.2 JWT Strategy

| Token       | Lifetime | Storage         | Purpose |
|-------------|----------|-----------------|---------|
| Access      | 15 min   | Memory (variable) | API authentication |
| Refresh     | 7 days   | httpOnly cookie   | Silently refresh access token |

---

## 5. Data Flow Diagrams

### 5.1 Admission Submission

```
Student                    Frontend               Backend              Database
  │                          │                       │                    │
  │  Fill admission form     │                       │                    │
  │ ────────────────────────►│                       │                    │
  │                          │  POST /api/admissions │                    │
  │                          │ ─────────────────────►│                    │
  │                          │                       │  Validate fields   │
  │                          │                       │  INSERT admission  │
  │                          │                       │ ──────────────────►│
  │                          │                       │◄──────────────────│
  │                          │                       │                    │
  │                          │                       │  CREATE notif for  │
  │                          │                       │  student + employee│
  │                          │                       │ ──────────────────►│
  │                          │                       │◄──────────────────│
  │                          │                       │                    │
  │                          │  { admission }        │                    │
  │                          │◄─────────────────────│                    │
  │  Show success toast      │                       │                    │
  │◄────────────────────────│                       │                    │
```

### 5.2 Exam Taking

```
Student                    Frontend               Backend              Database
  │                          │                       │                    │
  │  Click "Start Exam"      │                       │                    │
  │ ────────────────────────►│                       │                    │
  │                          │  POST /api/exams/     │                    │
  │                          │   registrations/:id/  │                    │
  │                          │   start               │                    │
  │                          │ ─────────────────────►│                    │
  │                          │                       │  UPDATE reg SET    │
  │                          │                       │  status='started', │
  │                          │                       │  startedAt=NOW()   │
  │                          │                       │ ──────────────────►│
  │                          │  { questions, reg }   │                    │
  │                          │◄─────────────────────│                    │
  │                          │                       │                    │
  │  Answer questions        │                       │                    │
  │  (timer running)         │                       │                    │
  │ ────────────────────────►│                       │                    │
  │                          │  POST /api/results/   │                    │
  │                          │   submit              │                    │
  │                          │  { answers }          │                    │
  │                          │ ─────────────────────►│                    │
  │                          │                       │  Score MC answers  │
  │                          │                       │  Defer essay score │
  │                          │                       │  INSERT results    │
  │                          │                       │  INSERT essays     │
  │                          │                       │  UPDATE reg status │
  │                          │                       │ ──────────────────►│
  │                          │  { score, passed }    │                    │
  │                          │◄─────────────────────│                    │
  │  Show results            │                       │                    │
  │◄────────────────────────│                       │                    │
```

---

## 6. Security Architecture

### 6.1 Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (TLS 1.3) |
| Authentication | JWT tokens (access + refresh) |
| Authorization | RBAC middleware checking `req.user.role` |
| Password | bcrypt with salt rounds = 12 |
| Session | Stateless (JWT); refresh tokens in httpOnly cookies |
| CSRF | Not needed (JWT in Authorization header, not cookies) |
| XSS | Input sanitization, output escaping, CSP headers |
| SQL Injection | Parameterized queries via ORM |

### 6.2 RBAC Permission Matrix

| Endpoint              | Admin | Registrar | Exam Coord | Applicant |
|-----------------------|:-----:|:---------:|:----------:|:---------:|
| GET /admissions       | ✅    | ✅        | ❌         | Own only  |
| POST /admissions      | ❌    | ❌        | ❌         | ✅        |
| PATCH /admissions/:id | ✅    | ✅        | ❌         | ❌        |
| GET /exams            | ✅    | ✅        | ✅         | Own grade |
| POST /exams           | ✅    | ❌        | ✅         | ❌        |
| POST /exams/register  | ❌    | ❌        | ❌         | ✅        |
| POST /results/submit  | ❌    | ❌        | ❌         | ✅        |
| PATCH /results/score  | ✅    | ❌        | ✅         | ❌        |
| GET /users            | ✅    | ❌        | ❌         | ❌        |
| POST /users           | ✅    | ❌        | ❌         | ❌        |
| GET /reports          | ✅    | ✅        | ✅         | ❌        |

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                 PRODUCTION                        │
│                                                   │
│  ┌──────────────┐      ┌──────────────────┐      │
│  │  Vercel /    │      │  Railway /       │      │
│  │  Netlify     │      │  Render          │      │
│  │              │      │                  │      │
│  │  React SPA   │─────►│  Node.js API     │      │
│  │  (Static)    │ API  │  (Express)       │      │
│  │              │      │                  │      │
│  └──────────────┘      └───────┬──────────┘      │
│                                │                  │
│                        ┌───────▼──────────┐      │
│                        │  PlanetScale /   │      │
│                        │  Supabase DB /   │      │
│                        │  Railway MySQL   │      │
│                        └──────────────────┘      │
└─────────────────────────────────────────────────┘
```

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=mysql://user:pass@host:3306/goldenkey

# JWT
JWT_SECRET=<random-256-bit-key>
JWT_REFRESH_SECRET=<random-256-bit-key>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
FRONTEND_URL=https://goldenkey.vercel.app
```

---

## 8. Error Handling Strategy

| Layer      | Strategy |
|------------|----------|
| Frontend   | `ErrorBoundary` component catches render errors; `try/catch` in API calls; Toast notifications for user-facing errors |
| API Layer  | Centralized `errorHandler` middleware; structured error responses `{ error: { code, message, details } }` |
| Database   | ORM-level constraint validation; unique index violations return 409 |
| Network    | Retry logic with exponential backoff for transient failures |

### Standard Error Response Format

```json
{
  "error": {
    "code": "ADMISSION_INVALID_TRANSITION",
    "message": "Cannot transition from 'Submitted' to 'Accepted'.",
    "status": 400
  }
}
```
