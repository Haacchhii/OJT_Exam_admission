# Feasibility Study

| Field | Details |
|---|---|
| **Project Name** | **GKISSJ: Online Entrance Exams & Admissions System — Golden Key Integrated School of St. Joseph** |
| **Prepared By** | Intern Development Team (Dayaday, Iturralde, Lim, Mabilangan, Sacdalan) |
| **Date** | 2025 |

---

## 1. Executive Summary

### Purpose

The GKISSJ project aims to move the school's applicant intake process from a manual, paper-based workflow to a centralized digital platform that can be accessed online by applicants, parents, and school staff. This feasibility study evaluates the market, technical, organizational, and financial aspects to determine the project's viability.

### Key Findings

- The education sector is rapidly adopting digital enrollment and assessment systems, creating strong demand for streamlined school management solutions.
- There is a clear need to replace manual, paper-based admission and examination workflows that are prone to errors, delays, and data loss.
- The required technology (React, Express, PostgreSQL, JWT) is mature, open-source, and well-documented, making development feasible.
- The intern development team has the necessary technical skills in full-stack web development, UI/UX design, and project management.
- The project leverages free-tier cloud services and open-source tools, keeping development costs minimal.
- Identified risks include user adoption resistance, internet connectivity requirements, and data migration challenges.

### Recommendations

- Proceed with the project using an agile, phased implementation approach.
- Conduct user training sessions for school staff unfamiliar with digital systems.
- Implement robust data validation and security mechanisms to ensure reliability and compliance.

---

## 2. Introduction

### Project Background

Most schools that still rely on manual admission processes face a common set of issues. Based on what is known about this type of system, the following problems are present or anticipated at Golden Key Integrated School of St. Joseph:

- Applicants must visit the school in person to get and submit application forms.
- Entrance exam scheduling is done manually, which is time-consuming for staff.
- Exam results are processed and recorded by hand, increasing the chance of errors.
- There is no centralized way to track the status of each applicant.
- Communication between the school and applicants relies on phone calls or walk-ins.
- Documents and exam records are stored in physical folders, making retrieval difficult.

These problems slow down the admissions process and create a poor experience for both staff and applicants. GKISSJ is designed to digitize these workflows through an integrated web platform.

### Objectives

- Assess the market potential and demand for digital school admission and examination systems.
- Evaluate the technical feasibility of the proposed web application.
- Determine resource requirements and implementation approach.
- Identify risks and develop mitigation strategies.

### Scope

This study covers market analysis, technical requirements, organizational feasibility, and risk assessment. The scope is limited to admissions and entrance exams only — it excludes enrollment and other school operations, physical infrastructure procurement, and third-party system integrations.

---

## 3. Market Feasibility

### Industry Analysis

- The Philippine education sector is undergoing rapid digital transformation, accelerated by DepEd's push for ICT integration in schools.
- K-12 private schools are increasingly adopting online enrollment and assessment platforms to improve operational efficiency.
- The COVID-19 pandemic permanently shifted expectations toward digital-first school processes.

### Target Market

- Private K-12 schools in the Philippines, specifically Golden Key Integrated School of St. Joseph.
- School administrators, registrars, teachers, and student applicants (Kindergarten through Grade 12, including Senior High School tracks: STEM, ABM, HUMSS, GAS).

### Competitive Analysis

- Existing school management systems (e.g., DepEd LIS, generic SIS platforms) focus on enrollment records but lack integrated entrance examination features.
- Most solutions are expensive enterprise platforms not tailored to small-to-medium private schools.
- GKISSJ's integrated admission + examination + results pipeline with role-based access gives it a unique advantage.

### Market Demand

- High demand from private schools seeking affordable, customized digital admission systems.
- Increasing parent/student expectation for online application tracking and real-time updates.
- Growing need for data-driven reporting on admissions and exam performance.

---

## 4. Technical Feasibility

### Technology Requirements

The following technologies were selected based on common, reliable tools used for school management systems, and confirmed during the development phase:

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React.js with Vite and Tailwind CSS | Web interface — responsive design for mobile, tablet, and desktop |
| Backend | Node.js with Express | Server-side logic and RESTful API |
| Database | PostgreSQL (Supabase) | Storing applicant records, exam content, and results |
| ORM | Prisma | Type-safe database access and migrations |
| Authentication | JWT (jsonwebtoken), bcryptjs | Secure login and session management |
| Security | Helmet, CORS, express-rate-limit | HTTP security headers, origin control, rate limiting |
| File Storage | Multer | Document upload handling with server-side storage |
| Hosting | Cloud hosting (Supabase for DB, deployment TBD) | Scalable infrastructure |

### Operational Plan

- System development follows agile sprints with continuous integration.
- Database hosted on Supabase PostgreSQL with automatic backups.
- Frontend deployed as a static SPA (Vite build) with code splitting and lazy loading.
- Backend deployed as a Node.js Express server.

### Location and Facilities

- Cloud-based infrastructure via Supabase (database) with potential deployment on Vercel/Railway.
- Development conducted remotely by the team using Git version control.
- No physical server infrastructure required.

### Technical Challenges

- Ensuring exam session integrity during unstable internet connections (mitigated by crash recovery and auto-resume).
- Handling concurrent exam-takers during peak enrollment periods (mitigated by rate limiting and database connection pooling).
- Securely managing document uploads and file storage.
- Maintaining data accuracy during migration from paper-based records.

---

## 5. Organizational Feasibility

### Management Team

The intern development team (The GanttFathers) consists of five members with complementary skills in project management, full-stack development, UI/UX design, quality assurance, and documentation.

### Organizational Structure

| Role | Responsibility |
|---|---|
| Project Manager (Jaeho Sacdalan) | Project planning, stakeholder coordination, timeline management |
| Full-Stack Developer & QA (Jose Iturralde) | Frontend/backend development, testing, security implementation |
| Software Developer (Vincent Mabilangan) | Backend API, database models, business logic |
| UI/UX Designer (Ricci Lim) | Interface design, prototyping, user experience |
| Documentation & Testing (Nicole Dayaday) | Documentation, user testing, feedback collection |

### Human Resources

- All required roles are filled by the existing intern team members.
- Technical expertise in React, Express, Prisma, PostgreSQL, and Tailwind CSS is available within the team.
- Admin staff at the school will need basic training to use the new system.

---

## 6. Financial Feasibility

### Cost Structure

The project leverages open-source technologies and free-tier cloud services to minimize costs:

| Item | Cost Approach |
|---|---|
| Frontend Development (React + Vite + Tailwind CSS) | Intern team — no additional cost |
| Backend Development (Express + Prisma + JWT) | Intern team — no additional cost |
| Database & Hosting (Supabase PostgreSQL) | Free tier during development; minimal cost for production |
| UI/UX Design & Prototyping | Intern team — no additional cost |
| Testing & Quality Assurance | Intern team — no additional cost |
| Domain & SSL | Minimal cost (TBD based on school's existing infrastructure) |
| Staff Training | Included in deployment phase |

*Note: Since this is an internship project, the primary costs are hosting and infrastructure. Specific budget figures will be determined once hosting and deployment decisions are finalized with the school.*

### Cost Savings

- Eliminates expenses related to paper forms, physical document storage, and manual processing.
- Reduces staff time spent on manual exam scoring and applicant status tracking.
- Centralizes records digitally, reducing retrieval time and lost document incidents.

### Financial Analysis

- Operational cost savings are expected within the first admissions cycle due to reduced paper, manual labor, and processing time.
- ROI is positive when factoring in reduced administrative overhead and faster enrollment processing.
- Long-term sustainability through minimal hosting costs and ongoing maintenance by the school's IT staff.

---

## 7. Risk Assessment

### Risk Identification

- User adoption resistance from staff accustomed to manual processes.
- Internet connectivity issues in the school environment.
- Data migration accuracy from paper records to the digital system.
- Peak-period system performance under concurrent exam sessions.
- Data privacy compliance with RA 10173.

### Risk Mitigation

- Conduct hands-on training workshops for all school staff users.
- Implement offline-friendly features where possible and crash recovery for exam sessions.
- Develop data validation tools and conduct thorough verification during migration.
- Stress-test the system with simulated concurrent users before deployment.
- Implement encryption, secure authentication, and audit logging for compliance.

### Contingency Plans

- Emergency rollback procedures if critical bugs are discovered post-deployment.
- Manual process fallback during the transition period.
- Additional budget allocation for unforeseen technical challenges.

---

## 8. Conclusion and Recommendations

### Summary of Findings

The GKISSJ project is feasible with strong institutional demand, proven technical viability using mature open-source technologies, and a capable intern development team. The system directly addresses the school's operational pain points in admission and examination management.

### Final Recommendations

- Proceed with phased development and implementation as outlined in the proposal.
- Meet with registrar and admin staff to walk through the current admissions workflow.
- Prioritize user training and change management to ensure smooth adoption.
- Conduct thorough testing with school staff and sample applicants before full deployment.

### Next Steps

- Identify specific requirements, exam formats, and grading criteria used by the school.
- Confirm the preferred hosting setup.
- Review any existing systems or tools the school already uses.
- Finalize the project timeline and assign tasks to team members.
- Begin Phase 1 (Planning) — requirements gathering, workflow mapping, and system design.

---

## 9. Appendices

- Technical system architecture diagram
- Database schema (Prisma models)
- User role and permission matrix
- Risk assessment matrix
