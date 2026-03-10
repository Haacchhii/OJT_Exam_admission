# Risk Assessment

| Field | Details |
|---|---|
| **Project Name** | **GKISSJ: Online Entrance Exams & Admissions System — Golden Key Integrated School of St. Joseph** |
| **Project Manager** | Jaeho Sacdalan |
| **Date** | 2025 |

---

## 1. Introduction

The purpose of this risk assessment document is to identify, analyze, and manage potential risks that may affect the successful execution of the GKISSJ project — the Online Entrance Exams & Admissions System for Golden Key Integrated School of St. Joseph. By assessing risks early, we can develop proactive mitigation strategies to minimize their impact on project objectives, timeline, and quality.

---

## 2. Risk Register

| Risk ID | Risk Description | Likelihood | Impact | Risk Score (1-10) | Mitigation Strategy | Owner | Status |
|---|---|---|---|---|---|---|---|
| R1 | User adoption resistance from school staff unfamiliar with digital systems | High | High | 9 | Conduct comprehensive training workshops and provide user manuals; implement intuitive UI with responsive design | UI/UX Designer & Documentation Team | Open |
| R2 | Internet connectivity issues disrupting exam sessions or application submissions | High | High | 8 | Implement crash recovery and auto-resume for exam sessions; add `beforeunload` warnings; optimize for low-bandwidth usage | Full-Stack Developer | Open |
| R3 | Data migration errors when converting paper-based records to digital format | Medium | High | 7 | Develop data validation tools; conduct multi-round verification; maintain parallel manual records during transition | Software Developer | Open |
| R4 | System performance degradation during peak enrollment with concurrent exam-takers | Medium | High | 7 | Implement rate limiting (300 req/15min global, 20 req/15min auth); use database connection pooling; conduct stress testing | Full-Stack Developer | Open |
| R5 | Cybersecurity threats compromising student personal data and exam integrity | High | High | 9 | Implement JWT authentication, bcrypt password hashing (12 rounds), Helmet security headers, CORS, rate limiting, file upload MIME validation, session integrity hash | Full-Stack Developer | Open |
| R6 | Data privacy non-compliance with RA 10173 (Data Privacy Act of 2012) | Medium | High | 7 | Implement data encryption, role-based access control, secure document storage; consult with legal advisors on compliance requirements | Project Manager | Open |
| R7 | Budget overruns due to scope creep or unforeseen technical challenges | Medium | Medium | 6 | Maintain strict scope definition; use agile sprints with clear deliverables; budget contingency allocation of ₱50,000 | Project Manager | Open |
| R8 | Delays in project timeline due to team availability or technical blockers | Medium | High | 7 | Develop contingency plans; allocate buffer time in sprint planning; maintain clear task assignments via project board | Project Manager | Open |
| R9 | Exam integrity issues (cheating, unauthorized access, answer sharing) | Medium | High | 7 | Implement timed sessions with server-side enforcement, randomized question ordering, auto-submit on timeout, double-submit prevention | Software Developer | Open |
| R10 | Document upload failures or storage issues affecting admission applications | Low | Medium | 5 | Implement Multer with MIME type validation (PDF, JPEG, PNG, WebP), 10MB file size limit; provide clear error messages; allow re-upload | Full-Stack Developer | Open |

---

## 3. Risk Analysis

### R1: User Adoption Resistance from School Staff

- **Likelihood:** High
- **Impact:** High
- **Risk Score:** 9
- **Mitigation Strategy:** Conduct comprehensive training workshops for administrators, registrars, and teachers. Provide printed and digital user manuals. Implement an intuitive glassmorphism UI with clear navigation and contextual help. Gather continuous feedback during UAT phase to refine usability.
- **Owner:** UI/UX Designer & Documentation Team
- **Status:** Open

### R2: Internet Connectivity Issues During Exam Sessions

- **Likelihood:** High
- **Impact:** High
- **Risk Score:** 8
- **Mitigation Strategy:** Implement crash recovery and auto-resume functionality for exam sessions (localStorage-based answer persistence). Add `beforeunload` browser warnings to prevent accidental navigation. Optimize API responses with gzip compression. Minimize payload sizes for exam data transfers.
- **Owner:** Full-Stack Developer
- **Status:** Open

### R3: Data Migration Errors from Paper-Based Records

- **Likelihood:** Medium
- **Impact:** High
- **Risk Score:** 7
- **Mitigation Strategy:** Develop automated data validation tools with format checking. Conduct multi-round verification with registrar staff. Maintain parallel paper-based records during the transition period. Use Prisma migrations with rollback capability for database schema changes.
- **Owner:** Software Developer
- **Status:** Open

### R4: System Performance During Peak Enrollment

- **Likelihood:** Medium
- **Impact:** High
- **Risk Score:** 7
- **Mitigation Strategy:** Configure global rate limiting (300 requests per 15 minutes per IP) and auth-specific rate limiting (20 requests per 15 minutes per IP). Use Supabase PostgreSQL connection pooling (pgbouncer on port 6543). Implement lazy loading and code splitting on frontend. Conduct load testing before deployment.
- **Owner:** Full-Stack Developer
- **Status:** Open

### R5: Cybersecurity Threats

- **Likelihood:** High
- **Impact:** High
- **Risk Score:** 9
- **Mitigation Strategy:** Implement multi-layered security: JWT token authentication with 7-day expiry, bcryptjs password hashing (12 salt rounds), Helmet for HTTP security headers, CORS with configured origins, express-rate-limit for DDoS protection, Multer with MIME type validation for file uploads, client-side session integrity hash for tamper detection, auto-logout on 401 responses.
- **Owner:** Full-Stack Developer
- **Status:** Open

### R6: Data Privacy Non-Compliance (RA 10173)

- **Likelihood:** Medium
- **Impact:** High
- **Risk Score:** 7
- **Mitigation Strategy:** Implement role-based access control ensuring only authorized personnel can view sensitive student data. Encrypt passwords with bcrypt. Store documents securely. Develop a privacy policy and data handling procedures. Consult with legal advisors on RA 10173 (Data Privacy Act) compliance requirements.
- **Owner:** Project Manager
- **Status:** Open

### R7: Budget Overruns

- **Likelihood:** Medium
- **Impact:** Medium
- **Risk Score:** 6
- **Mitigation Strategy:** Maintain strict scope definition using the project charter. Use agile sprints with clearly defined deliverables per iteration. Leverage free-tier cloud services (Supabase, Vercel) during development. Allocate ₱50,000 contingency budget for unexpected costs. Track expenses weekly.
- **Owner:** Project Manager
- **Status:** Open

### R8: Project Timeline Delays

- **Likelihood:** Medium
- **Impact:** High
- **Risk Score:** 7
- **Mitigation Strategy:** Implement buffer time (1-2 days) in each sprint. Maintain a prioritized backlog so critical features are developed first. Use Git version control with feature branches to enable parallel development. Hold weekly stand-up meetings to identify blockers early.
- **Owner:** Project Manager
- **Status:** Open

### R9: Exam Integrity Issues

- **Likelihood:** Medium
- **Impact:** High
- **Risk Score:** 7
- **Mitigation Strategy:** Enforce server-side exam timers that auto-submit when time expires. Implement double-submit prevention on the backend. Limit exam access to registered and authenticated users only. Log all exam start/submit events with timestamps. Consider implementing question pool randomization in future iterations.
- **Owner:** Software Developer
- **Status:** Open

### R10: Document Upload Failures

- **Likelihood:** Low
- **Impact:** Medium
- **Risk Score:** 5
- **Mitigation Strategy:** Configure Multer with strict MIME type validation (application/pdf, image/jpeg, image/png, image/webp). Set 10MB per-file upload limit. Provide clear, user-friendly error messages for invalid file types or oversized files. Allow applicants to re-upload documents at any time before submission.
- **Owner:** Full-Stack Developer
- **Status:** Open

---

## 4. Conclusion

The risk assessment for the GKISSJ project highlights several potential challenges, particularly in user adoption, internet reliability, cybersecurity, data privacy compliance, and exam integrity. With a structured approach to risk mitigation — including comprehensive security measures already implemented in the codebase, user training programs, and performance optimization strategies — these risks can be managed effectively to ensure the project's success. Continuous monitoring and proactive strategies will be essential in addressing these risks throughout the project lifecycle.
