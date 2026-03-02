# Project Requirements Document (PRD)

## GOLDEN KEY Integrated School of St. Joseph — Admission & Examination System

**Version:** 1.0  
**Date:** February 27, 2026  
**Author:** Development Team  

---

## 1. Executive Summary

The GOLDEN KEY Integrated School of St. Joseph requires a web-based Admission & Examination System to digitize and streamline student admission applications, entrance examination scheduling and administration, result management, and user account management. The system serves two primary user roles: **Applicants (Students)** and **Employees (Admin/Registrar/Exam Coordinator)**.

---

## 2. Project Scope

### 2.1 In Scope
- Online admission application submission and tracking
- Multi-step admission workflow management
- Entrance examination creation and scheduling
- Online timed exam-taking with multiple-choice and essay questions
- Automated scoring for multiple-choice; manual scoring for essays
- Exam result viewing and printing
- User account management (CRUD)
- Role-based access control (RBAC)
- Notification system
- Report generation with CSV export
- Print/PDF export for applications and results

### 2.2 Out of Scope (Phase 1)
- Online payment processing
- Document file upload (currently simulated with checkboxes)
- Email/SMS notification delivery
- Mobile native application
- Multi-school/multi-campus support

---

## 3. User Roles & Permissions

| Role              | Code               | Permissions |
|-------------------|---------------------|-------------|
| Administrator     | `administrator`     | Full access: manage users, admissions, exams, results, reports, system settings |
| Registrar         | `registrar`         | Manage admissions, view exams/results/reports |
| Exam Coordinator  | `exam_coordinator`  | Manage exams, schedules, score essays, view results |
| Applicant         | `applicant`         | Submit application, book exam slots, take exams, view own results |

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization
| ID     | Requirement |
|--------|-------------|
| AUTH-1 | Users can register an account with email, name, and password (min 8 chars) |
| AUTH-2 | Users can log in with email and password |
| AUTH-3 | Login rejects inactive/deactivated accounts |
| AUTH-4 | Applicants are redirected to `/student/*`; employees to `/employee/*` |
| AUTH-5 | Forgot/reset password flow (client-side for demo) |
| AUTH-6 | Session persists via localStorage (to be replaced with JWT) |
| AUTH-7 | Password must not be stored in the session/user object |

### 4.2 Admission Management
| ID     | Requirement |
|--------|-------------|
| ADM-1  | Applicant can submit a multi-step admission form (Personal Info → Guardian → Documents → Review) |
| ADM-2  | Form pre-fills first name, last name, and email from the logged-in user |
| ADM-3  | Applicant can only have ONE active application |
| ADM-4  | Application status workflow: `Submitted → Under Screening → Under Evaluation → Pending Payment → Accepted / Rejected` |
| ADM-5  | Only valid status transitions are allowed (see Section 7.1) |
| ADM-6  | Employee can filter/search/sort applications by name, email, status, grade level |
| ADM-7  | Employee can bulk-update application statuses |
| ADM-8  | Employee can print/export individual applications to PDF |
| ADM-9  | Applicant types: `New` or `Transferee` |
| ADM-10 | Required documents are validated at step 3 before advancing |
| ADM-11 | Age-appropriate grade validation (e.g., Grade 1 requires age ≥ 6) |
| ADM-12 | LRN (Learner Reference Number) field accepts only numeric input (12 digits) |
| ADM-13 | Phone number fields strip invalid characters |

### 4.3 Examination Management
| ID     | Requirement |
|--------|-------------|
| EXM-1  | Employee can create exams with title, grade level, duration, and passing score |
| EXM-2  | Exams support multiple-choice and essay question types |
| EXM-3  | Multiple-choice questions have 4 options with exactly 1 correct answer |
| EXM-4  | Essay questions have configurable max points |
| EXM-5  | Employee can create exam schedules (date, time, venue, max slots) |
| EXM-6  | Employee can edit/delete exams (with cascade to schedules/registrations/results) |
| EXM-7  | Employee can edit/delete schedules (with cascade to registrations/results) |

### 4.4 Exam Registration & Taking
| ID     | Requirement |
|--------|-------------|
| REG-1  | Applicants with eligible admission status can book an exam slot |
| REG-2  | Eligible statuses: `Under Screening`, `Under Evaluation`, `Pending Payment` |
| REG-3  | Applicant cannot register for the same exam twice |
| REG-4  | Booking decrements available slots; full schedules cannot be booked |
| REG-5  | Exam lobby shows countdown timer to start time |
| REG-6  | Timed exam with countdown; remaining time calculated from `startedAt` |
| REG-7  | Crash recovery: if exam was started but not submitted, auto-resume on page load |
| REG-8  | `beforeunload` warning during active exam |
| REG-9  | Double-submit prevention |

### 4.5 Results & Scoring
| ID     | Requirement |
|--------|-------------|
| RES-1  | Multiple-choice auto-scored on submission |
| RES-2  | Essay questions remain "pending review" until manually scored |
| RES-3  | Pass/fail deferred until all essays are scored (if essays exist) |
| RES-4  | Employee can score individual essay answers (0 to maxPoints) |
| RES-5  | Scoring recalculates total, percentage, and pass/fail |
| RES-6  | Student can view their own results with score breakdown |
| RES-7  | Employee can filter results by exam, pass/fail, essay status |
| RES-8  | Results can be printed/exported to PDF |

### 4.6 User Management
| ID     | Requirement |
|--------|-------------|
| USR-1  | Admin can create, edit, and delete user accounts |
| USR-2  | Admin cannot delete their own account |
| USR-3  | Users can be set to Active or Inactive |
| USR-4  | Email uniqueness enforced |
| USR-5  | Password required for new users (min 8 characters) |

### 4.7 Notifications
| ID     | Requirement |
|--------|-------------|
| NTF-1  | In-app notifications for admission status changes |
| NTF-2  | In-app notifications for exam scheduling and results |
| NTF-3  | Notifications scoped to exact user (no cross-user leaks) |
| NTF-4  | Mark individual or all notifications as read |

### 4.8 Reports
| ID     | Requirement |
|--------|-------------|
| RPT-1  | Dashboard overview: admission stats, exam stats, recent activity |
| RPT-2  | CSV export for admissions and exam results data |
| RPT-3  | Summary metrics table with key performance indicators |

---

## 5. Non-Functional Requirements

| Category      | Requirement |
|---------------|-------------|
| Performance   | Page load under 2 seconds on broadband |
| Accessibility | ARIA landmarks, `scope="col"` on tables, keyboard navigation, focus trapping in modals |
| Responsiveness| Full mobile, tablet, and desktop support |
| Security      | Password hashing (bcrypt) in backend, JWT tokens, input validation, XSS prevention |
| Browser       | Chrome, Firefox, Edge, Safari (latest 2 versions) |
| Data          | Must handle 1,000+ admissions, 100+ exams without degradation |

---

## 6. Technology Stack

### 6.1 Current (Frontend-Only Demo)
| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + Vite 5 |
| Styling   | Tailwind CSS v4 |
| Routing   | React Router DOM v7 (HashRouter) |
| State     | React Context + localStorage |
| Build     | Vite (SPA) |

### 6.2 Target (Full Stack)
| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + Vite 5 + Tailwind v4 |
| Backend   | Node.js + Express.js |
| Database  | MySQL / PostgreSQL |
| Auth      | JWT (access + refresh tokens) |
| ORM       | Prisma / Sequelize |
| Deploy    | Vercel (FE) + Railway/Render (BE) |

---

## 7. Business Rules

### 7.1 Admission Status Transitions

```
Submitted ──→ Under Screening ──→ Under Evaluation ──→ Pending Payment ──→ Accepted
    │               │                    │                    │
    └── Rejected ◄──┘── Rejected ◄───────┘── Rejected ◄──────┘
    
Rejected ──→ Submitted  (re-submit)
Accepted ──→ (terminal)
```

Valid transitions:
| From              | Can Go To |
|-------------------|-----------|
| Submitted         | Under Screening, Rejected |
| Under Screening   | Under Evaluation, Rejected |
| Under Evaluation  | Pending Payment, Rejected |
| Pending Payment   | Accepted, Rejected |
| Accepted          | *(terminal — no further transitions)* |
| Rejected          | Submitted |

### 7.2 Exam Eligibility
- Applicants must have admission status: `Under Screening`, `Under Evaluation`, or `Pending Payment`
- `Submitted`, `Accepted`, and `Rejected` are **not** exam-eligible

### 7.3 Grade Levels Offered
- Kindergarten, Grade 1–10, Grade 11 (STEM, ABM, HUMSS, GAS), Grade 12 (STEM, ABM, HUMSS, GAS)

---

## 8. Glossary

| Term | Definition |
|------|------------|
| LRN | Learner Reference Number — 12-digit unique student identifier issued by DepEd |
| PSA | Philippine Statistics Authority — issues birth certificates |
| ESC | Education Service Contracting — government voucher program |
| Form 138 | Student's report card from previous school |
| SHS | Senior High School (Grade 11–12) |
| Applicant Type | `New` (first-time student) or `Transferee` (from another school) |
