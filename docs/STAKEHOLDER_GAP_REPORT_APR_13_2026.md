# Stakeholder Gap Report

Date: April 13, 2026
System: Golden Key Admissions and Examination Platform
Reviewer Lens: Real operational stakeholders (Applicant, Registrar, Teacher, Administrator)

## 1. Executive Summary

The system is operationally strong for core exam and admissions workflows, but several business-rule parity and operational clarity gaps can reduce trust and increase support load. The highest-risk pattern is when policy is enforced in the UI but not consistently in backend APIs.

Overall assessment:
- Workflow coverage: Strong
- Policy consistency: Moderate
- Operational readiness: Strong with targeted hardening

## 2. Findings by Severity

### Critical

1. Business-rule parity risk (historical, now addressed in backend)
- Description: Admission creation was gated in UI by exam completion, but this rule was not explicit in backend admission creation logic.
- Stakeholder impact: A direct API caller could bypass expected applicant progression, causing process integrity issues for registrar review.
- Resolution status: Fixed on April 13, 2026 by backend admission gate enforcement.
- Owner: Backend API

### High

2. Verification policy consistency risk
- Description: Login/register response signaling for email verification could conflict with deployment policy when verification was disabled.
- Stakeholder impact: Confusing onboarding outcomes and support tickets due to inconsistent behavior across environments.
- Resolution status: Fixed on April 13, 2026 by conditioning auth response behavior on EMAIL_VERIFICATION_REQUIRED.
- Owner: Backend Auth

3. Stakeholder report freshness
- Description: Existing broad stakeholder report artifact still reflects a previously failing run.
- Stakeholder impact: Leadership can make decisions from stale evidence.
- Resolution status: Needs report refresh with latest passing run.
- Owner: QA / Documentation

### Medium

4. Role scope documentation mismatch (Registrar)
- Description: Some docs imply registrar user-management access while runtime permissions restrict registrar to dashboard, admissions, results, reports.
- Stakeholder impact: Training confusion and expectation mismatch.
- Resolution status: Pending doc alignment.
- Owner: Product Docs

5. De-scoped proactive notifications
- Description: Notification module is intentionally out of scope in current phase.
- Stakeholder impact: Users depend on manual status checks, increasing drop-off and support burden.
- Resolution status: Accepted scope decision; future phase candidate.
- Owner: Product / Roadmap

### Low

6. Automated testing depth still partial in status report
- Description: Frontend unit/integration depth and some edge-case E2E coverage are still limited.
- Stakeholder impact: Increased regression risk during rapid changes.
- Resolution status: Ongoing improvement needed.
- Owner: QA Engineering

## 3. Stakeholder Goal Fit

### Applicant
- Goal: Complete exam and submit admission without confusion.
- Fit: Strong, improved by backend parity fix.
- Remaining concern: Limited proactive status nudges.

### Registrar
- Goal: Process queue quickly with clear guardrails.
- Fit: Strong (transition validation, filtering, bulk actions).
- Remaining concern: Doc mismatch on role expectations.

### Teacher
- Goal: Manage exams/schedules and score reliably.
- Fit: Strong.
- Remaining concern: Additional edge-case scoring regression tests.

### Administrator
- Goal: Govern users, periods, and auditability.
- Fit: Strong.
- Remaining concern: Ensure artifacts and reports always reflect latest validated runs.

## 4. Recommended Priority Order

1. Keep backend business-rule parity as mandatory policy for every future UX gate.
2. Refresh stakeholder navigation report artifacts after each fix cycle.
3. Align role documentation to runtime permissions.
4. Expand targeted E2E edge-case suites for onboarding and admissions transitions.
5. Revisit notification roadmap for reduced applicant friction.

## 5. Acceptance Criteria for Closure

- Admission gate parity confirmed by backend tests and manual API probe.
- Auth verification behavior consistent across enabled/disabled policy modes.
- Role documentation matches runtime permission matrix exactly.
- Stakeholder test report reflects latest execution status.
