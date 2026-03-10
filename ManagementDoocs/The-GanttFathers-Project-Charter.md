# Project Charter

## Project Information

| Field | Details |
|---|---|
| **Project Title/Name** | **GKISSJ: Online Entrance Exams & Admissions System — Golden Key Integrated School of St. Joseph** |
| **Project Description** | This project proposes an Online Entrance Exams and Admissions System for Golden Key Integrated School of St. Joseph. The goal is to move the school's applicant intake process from a manual, paper-based workflow to a centralized digital platform that can be accessed online by applicants, parents, and school staff. The system covers the full admissions pipeline — from online registration and document upload, through entrance exam scheduling, timed online exam-taking with automatic scoring, to results release and applicant status tracking. |
| **Prepared By** | Intern Development Team |
| **Project Manager** | Jaeho Sacdalan |
| **Date** | 2025 |
| **Scope** | Admissions & Entrance Exam |

---

## Objectives

- Allow applicants to register and apply online without visiting the school.
- Let applicants take entrance exams online at a scheduled time.
- Automatically compute and release exam results.
- Give school administrators a dashboard to manage applicants and track their status.
- Send automated notifications to applicants about their application and exam status.
- Store all applicant records digitally for easy access and reporting.

---

## Scope

| Inclusions | Exclusions |
|---|---|
| Online applicant registration and account creation | Enrollment and other school operations beyond admissions |
| Document upload (birth certificates, report cards, ID photos) | Payment processing and fee management |
| Entrance exam scheduling with available time slots | Third-party standardized testing integration |
| Timed online entrance exam (multiple choice and essay) | Mobile native applications (iOS/Android) |
| Automatic scoring for multiple-choice questions | AI-based essay auto-grading |
| Manual review of essay/open-ended items by staff | Full-scale student information system (SIS) |
| Result viewing and admission status tracking | Physical document verification and in-person interviews |
| Role-based dashboards, reports, and data export | |
| Notifications for application updates and exam reminders | |

---

## Deliverables

- A fully functional web-based platform with two main portals: Applicant Portal and Administrator Portal.
- **Authentication Module** — Registration, login, password reset, and session management for all users.
- **Application Module** — Online submission and review of applicant information and uploaded documents.
- **Exam Module** — Exam creation, scheduling, delivery, timing, and submission.
- **Scoring Module** — Automatic scoring for objective items and manual review for essay items.
- **Notification Module** — Automated notifications based on system events (application updates, exam reminders, results).
- **Dashboard Module** — Admin overview of application volumes, exam results, and pending actions.
- **Reporting Module** — Printable and exportable reports for records and school decisions.
- **User Management Module** — Admin account creation and role-based access control.

---

## Initial Constraints / Assumptions

- The school has a stable internet connection available for both staff and applicants.
- Applicants have access to a device (phone or computer) and internet to complete the process.
- The school does not yet have an existing digital admissions system.
- Admin staff will need basic training to use the new system.
- Exam questions will be provided by the school and encoded into the system before go-live.
- The scope covers admissions and entrance exams only, not enrollment or other school operations.
- Further refinement will be done once the development team has met with school staff to understand specific workflows and requirements.

---

## Roles and Responsibilities

| # | Name | Role | Responsibilities |
|---|---|---|---|
| 1 | Jaeho Sacdalan | Project Manager | Oversees project execution, timelines, and stakeholder coordination. |
| 2 | Jose Iturralde | Full-Stack Developer & QA | Develops the frontend and backend, implements system features, and ensures functionality and reliability through testing. |
| 3 | Vincent Mabilangan | Software Developer | Builds and maintains backend API routes, database models, and business logic. |
| 4 | Ricci Lim | UI/UX Designer | Designs user-friendly interfaces for accessibility and responsiveness across devices. |
| 5 | Nicole Dayaday | Documentation & Testing | Manages project documentation, collects user feedback, and assists in quality assurance. |

---

## User Roles & Access

| Role | Access |
|---|---|
| Applicant | Can register, submit application, upload documents, take the entrance exam, and view results. |
| Registrar / Admission Staff | Can view and manage applications, update statuses, and communicate with applicants. |
| Exam Coordinator | Can create and manage exam content, set schedules, and review manually-scored items. |
| Administrator / Principal | Has full access to all modules including reports, user management, and system settings. |

---

## Stakeholders

- School administration and principal.
- Registrar's office / admission staff.
- Teachers and exam coordinators.
- Student applicants and their parents/guardians.
- IT department and technical support staff.
- School board and decision-makers.

---

## Timeline

| Phase | Description | Duration |
|---|---|---|
| Phase 1 — Planning | Requirements gathering, workflow mapping, and system design. | ~2 weeks |
| Phase 2 — Development | Build all core modules: auth, application, exam, scoring, and notifications. | ~6–8 weeks |
| Phase 3 — Testing | Unit testing, user acceptance testing (UAT) with school staff and sample applicants. | ~2 weeks |
| Phase 4 — Deployment | Deploy to production server, train staff, and go live. | ~1 week |
| Phase 5 — Support | Monitor the system, fix bugs, and gather feedback for future improvements. | Ongoing |

---

## Proposed Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js with Vite and Tailwind CSS for the web interface |
| Backend | Node.js with Express for server-side logic |
| Database | PostgreSQL (Supabase) for storing applicant records, exam content, and results |
| ORM | Prisma for type-safe database access and migrations |
| Authentication | JWT (jsonwebtoken) and bcryptjs for secure token-based auth |
| File Storage | Multer for document upload handling with server-side storage |
| Hosting | Cloud hosting provider (Supabase for DB, deployment TBD) |

---

## Expected Benefits

- Reduces time and effort for both applicants and staff during the admissions period.
- Eliminates paper forms and physical document storage.
- Allows applicants outside the area to apply without traveling to the school.
- Speeds up exam processing through automatic scoring.
- Provides the school with accurate data for admissions planning and reporting.
- Improves the overall experience and image of the school during the application period.

---

## Next Steps

- Meet with the registrar and admin staff to walk through the current admissions workflow.
- Identify specific requirements, exam formats, and grading criteria used by the school.
- Confirm the preferred technology stack and hosting setup.
- Review any existing systems or tools the school already uses.
- Finalize the project timeline and assign tasks to team members.

---

## Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Project Sponsor | | | |
| Project Manager | Jaeho Sacdalan | | |
