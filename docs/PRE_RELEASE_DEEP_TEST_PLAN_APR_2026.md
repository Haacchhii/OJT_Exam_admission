# Pre-Release Deep Testing Plan (Deployed Web System)

Version: April 20, 2026
Purpose: Validate release readiness through layered, risk-driven testing before production approval.
Scope: Application logic, UI behavior, API contracts, security posture, reliability under stress, data safety, and stakeholder acceptance.

## 1) Test Mix Rationale

This plan uses multiple test types in sequence so each layer finds defects at the lowest-cost point, then confirms real user outcomes in production-like conditions.

| Test Type | Why It Is Included | Primary Risk Addressed | Relative Effort |
|---|---|---|---|
| Unit | Fast verification of business rules and edge handling in isolation | Logic regressions in core rules | Medium |
| Component | Validate UI/backend modules with realistic dependencies and state | Broken module behavior hidden by isolated unit tests | Medium |
| Integration | Verify boundaries between services, DB, cache, auth, and queues | Cross-service failures and schema mismatches | High |
| Contract | Enforce request/response compatibility between consumers and providers | Breaking API changes despite passing integration tests | Medium |
| End-to-end / Use-case | Prove critical user journeys work from UI to persistence | Workflow blockers and role-flow breaks | High |
| Regression | Re-check known high-value behavior after fixes and merges | Previously fixed defects returning | High |
| Exploratory | Discover unknown risks through focused investigator testing | Unscripted failures and edge interactions | Medium |
| Usability | Confirm users can complete tasks accurately and efficiently | Task friction, confusion, avoidable errors | Medium |
| Accessibility | Verify conformance for keyboard/screen reader/contrast support | Exclusion risk and compliance failures | Medium |
| Security | Validate authz/authn, input handling, session and dependency risk | Data exposure, privilege escalation, injection | High |
| Performance | Measure latency/throughput/resource behavior at expected load | Slowdowns and saturation before release | High |
| Resilience / Failover | Confirm recovery and continuity during partial outages | Cascading failure and poor degradation behavior | High |
| Data Integrity | Ensure correctness, consistency, and referential safety | Corrupt or inconsistent records | High |
| Backup-Restore | Prove recoverability and RPO/RTO expectations | Irrecoverable data loss | Medium |
| UAT | Obtain role-owner confirmation against business outcomes | Feature technically correct but operationally unacceptable | High |

Target coverage mix for this cycle:

- Shift-left depth: unit + component + integration + contract = about 45% of total execution effort
- User-outcome depth: end-to-end/use-case + regression + exploratory + usability + accessibility = about 35%
- Operational readiness: security + performance + resilience/failover + data integrity + backup-restore + UAT = about 20%

## 2) Phase-by-Phase Execution Order With Timeboxes

Recommended execution window: 2 business days, with a hard go/no-go checkpoint at the end of Day 2.

### Phase 0: Readiness and Baseline Lock (1.5 hours)

Activities:

- Confirm build artifact version, environment URL, and configuration freeze
- Freeze test data seed snapshot and reference dataset IDs
- Confirm logging, tracing, and metrics are available for debugging
- Finalize risk list and critical journeys to be treated as release blockers

Output:

- Signed test baseline record and execution roster

### Phase 1: Shift-Left Verification (4 hours)

Test types executed:

- Unit
- Component
- Contract (consumer and provider checks)

Activities:

- Run unit and component suites in CI parity mode
- Execute contract tests against current deployed API versions
- Triage immediate breaks and patch high-confidence fixes

Output:

- Stable green baseline for unit/component/contract layers

### Phase 2: System Coupling and Data Reliability (4.5 hours)

Test types executed:

- Integration
- Data integrity

Activities:

- Validate service-to-service interactions and persistence workflows
- Verify transaction boundaries, idempotency, and rollback behavior
- Run data reconciliation checks for critical entities and aggregate views

Output:

- Evidence that system boundaries and persisted outcomes are consistent

### Phase 3: Business Flow Confidence (5 hours)

Test types executed:

- End-to-end / use-case
- Regression
- Exploratory
- Usability
- Accessibility

Activities:

- Run automated critical path journeys for major user roles
- Execute targeted regression pack for previously high-severity defects
- Perform charter-based exploratory sessions on edge transitions and unusual sequences
- Conduct focused usability walkthroughs with task success metrics
- Execute accessibility checks (keyboard-only, screen-reader path, color contrast, focus order)

Output:

- Verified task completion across roles, plus findings on experience and access barriers

### Phase 4: Operational Hardening (4.5 hours)

Test types executed:

- Security
- Performance
- Resilience / failover
- Backup-restore

Activities:

- Run security negatives for authorization, input validation, and session controls
- Execute performance profile at expected and peak load tiers
- Inject failure scenarios: service restart, downstream timeout, partial dependency loss
- Validate graceful degradation and recovery behavior
- Perform backup creation plus full restore drill into clean target environment

Output:

- Evidence of secure operation, acceptable performance, controlled failure handling, and recoverability

### Phase 5: UAT and Release Decision (3 hours)

Test types executed:

- UAT

Activities:

- Business stakeholders execute scenario scripts by role
- Confirm acceptance criteria, policy compliance, and operational readiness
- Hold release review board with defect status and risk exceptions

Output:

- Signed UAT decision and formal go/no-go result

Total planned effort: 22.5 hours across a 2-day pre-release cycle.

## 3) Entry and Exit Criteria

### Global Entry Criteria (Must Be True Before Phase 0)

- Deployed test target is stable and reachable
- Release candidate build is immutable and version-tagged
- Test identities exist for all required roles and permission tiers
- Required data fixtures are loaded and validated
- Monitoring and alerting are enabled for test window
- Incident queue has no unresolved environment blocker

### Phase Exit Criteria

Phase 0 exit:

- Baseline lock completed
- Critical journey list approved
- Test ownership matrix confirmed

Phase 1 exit:

- No open Severity 1 defects from unit/component/contract execution
- Contract mismatches are zero for release-blocking endpoints
- Flaky test rate below 2% in this phase run

Phase 2 exit:

- Integration critical paths pass at least once cleanly end-to-end
- Data reconciliation variance is 0 for critical entities
- No unresolved transaction consistency defect at Severity 1 or 2

Phase 3 exit:

- Critical end-to-end journeys pass for each role in scope
- Regression pack pass rate at least 98% (failures only accepted with approved workaround)
- Accessibility blockers at Severity 1 or 2 are zero
- Usability critical task success rate at least 90%

Phase 4 exit:

- No unresolved exploitable security defect at Severity 1 or 2
- P95 latency and error-rate thresholds meet release SLOs
- Failover scenarios recover within defined service recovery target
- Backup restore completes successfully with verified data parity

Phase 5 exit:

- UAT signoff from required business owners
- Go/no-go board decision recorded with accountable approvers

## 4) Defect Severity Policy

Severity 1 (Critical):

- Definition: System crash, data loss, auth bypass, payment/transaction corruption, or impossible completion of critical business flow
- Response: Immediate stop-the-line; release automatically blocked
- SLA target: Fix starts immediately; retest in same shift

Severity 2 (High):

- Definition: Major function unreliable or incorrect with no acceptable workaround; high security or compliance concern
- Response: Release blocked unless explicit risk exception is approved by release board
- SLA target: Fix within 24 hours and full impacted-path regression

Severity 3 (Medium):

- Definition: Non-critical function degraded; workaround exists; moderate user impact
- Response: Can ship only with documented workaround and committed post-release fix window
- SLA target: Fix in next scheduled patch

Severity 4 (Low):

- Definition: Cosmetic issue, minor copy/layout inconsistency, low impact edge behavior
- Response: Does not block release
- SLA target: Backlog with priority ranking

Retest policy:

- Every fixed Severity 1 or 2 defect requires direct retest plus impacted-regression rerun
- Security fixes require repeat of relevant abuse and authorization negatives
- Performance or resilience fixes require before/after comparison using identical load profiles

## 5) Go/No-Go Checklist

Mark each item Pass or Fail during release review.

- Build integrity: Release candidate hash/version matches tested artifact
- Unit testing: Pass
- Component testing: Pass
- Integration testing: Pass
- Contract testing: Pass
- End-to-end/use-case testing: Pass on all critical journeys
- Regression testing: Pass threshold met and no unapproved critical failure
- Exploratory testing: High-risk charters completed with findings triaged
- Usability testing: Critical tasks meet success threshold
- Accessibility testing: No open Severity 1 or 2 accessibility defects
- Security testing: No open Severity 1 or 2 security defects
- Performance testing: Meets agreed latency, throughput, and error-rate targets
- Resilience/failover testing: Recovery target met in injected-failure scenarios
- Data integrity testing: No unresolved critical reconciliation issue
- Backup-restore testing: Restore drill successful and data verified
- UAT: Required stakeholders signed off
- Defect posture: Zero open Severity 1; Severity 2 either resolved or formally exception-approved
- Operations readiness: Runbook, on-call, and rollback plan confirmed

Decision rule:

- Go: All checklist items pass, or any exception is formally approved with accountable owner and expiry date
- No-Go: Any failed release-blocking item without approved exception

## 6) Role-Based Mandatory Test Matrix (Release-Blocking)

Execution rule:

- Every checklist item below must be marked Pass for release, or have a written, owner-approved risk exception.
- Record test evidence link, tester name, and execution timestamp for each item.

### Applicant/Student

#### Integration

- [ ] Complete exam booking and admission submission flow; verify the same applicant record is visible in student views and registrar queue.
  Pass condition: Booking ID and admission ID persist after refresh/re-login and match backend records and staff-facing list entries.

#### End-to-end / Use-case

- [ ] Execute full applicant journey: login -> schedule exam -> take exam -> submit admission -> track application -> view result release.
  Pass condition: All steps complete without blocker, and status progression is correct at each stage.

#### Regression

- [ ] Re-run known high-risk student paths (closed/full slot rejection, exam window enforcement, tracker visibility).
  Pass condition: Previously fixed defects do not reappear; expected blocks and messages are intact.

#### Security / Authorization Negatives

- [ ] Attempt direct access to staff routes and other applicants' records using URL and API calls.
  Pass condition: Access is denied with 401/403 (or equivalent restriction view), and no foreign applicant data is exposed.

#### Usability / Accessibility

- [ ] Complete booking and admission form using keyboard-only navigation and screen-reader labels on required inputs/buttons.
  Pass condition: Focus order is logical, labels are announced, and critical tasks complete without mouse-only dependency.

#### Data Integrity

- [ ] Submit admission with attachments and verify persisted data after session restart.
  Pass condition: Field values, uploaded files, and status history remain unchanged and auditable.

#### UAT Signoff Check

- [ ] Applicant representative validates clarity of instructions, statuses, and errors.
  Pass condition: Representative signs off that task completion is understandable without staff intervention.

### Registrar

#### Integration

- [ ] Update admission status and notes; verify updates propagate to reports and applicant tracking.
  Pass condition: New status and notes appear consistently across registrar list/detail, reports, and student tracker.

#### End-to-end / Use-case

- [ ] Run registrar triage workflow: filter queue -> review documents -> apply valid transition -> export filtered report.
  Pass condition: Workflow completes with correct filter fidelity and export matches on-screen dataset.

#### Regression

- [ ] Re-test transitions with known edge states and bulk-action mixed eligibility behavior.
  Pass condition: Invalid transitions remain blocked and eligible records update correctly without partial corruption.

#### Security / Authorization Negatives

- [ ] Attempt access to Users, Audit Log write actions, and admin settings.
  Pass condition: Registrar cannot execute admin-only operations; backend rejects unauthorized attempts.

#### Usability / Accessibility

- [ ] Perform queue filtering and detail review on common viewport sizes with keyboard navigation.
  Pass condition: Critical controls remain reachable, visible, and understandable with no blocking layout shift.

#### Data Integrity

- [ ] Perform concurrent status updates on the same application from two sessions.
  Pass condition: Conflict handling prevents silent overwrite and final saved state is deterministic and logged.

#### UAT Signoff Check

- [ ] Registrar owner confirms operational readiness for daily admissions processing.
  Pass condition: Owner signs off that queue triage, transitions, and exports are production-usable.

### Teacher

#### Integration

- [ ] Create/edit exam, publish schedule, and verify student-facing exam availability reflects configured windows.
  Pass condition: Published exam metadata is consistent across teacher console and student exam page.

#### End-to-end / Use-case

- [ ] Execute teacher flow: author exam -> schedule -> review submissions -> score essays -> verify result updates.
  Pass condition: Score updates recalculate and appear in results without manual data correction.

#### Regression

- [ ] Re-run known fragile paths for schedule validation, essay scoring persistence, and tab navigation.
  Pass condition: No recurrence of previously fixed save/visibility or scoring-calculation defects.

#### Security / Authorization Negatives

- [ ] Attempt registrar-only admission transition actions and admin-only settings/user operations.
  Pass condition: Teacher role is blocked consistently in UI and API for forbidden operations.

#### Usability / Accessibility

- [ ] Perform exam authoring and essay scoring using keyboard and clear validation messaging.
  Pass condition: Validation errors are actionable, focus moves to the failing field, and scoring tasks remain efficient.

#### Data Integrity

- [ ] Edit scoring entries and verify audit trail and recalculated aggregates.
  Pass condition: Every score change is traceable, and aggregate totals match item-level scores.

#### UAT Signoff Check

- [ ] Teacher owner validates exam setup and scoring workload feasibility.
  Pass condition: Owner signs off that exam management and scoring are accurate and practical under normal load.

### Administrator

#### Integration

- [ ] Create/update users and academic period settings; verify access and period constraints propagate system-wide.
  Pass condition: Role/period changes are reflected immediately (or within defined cache interval) across modules.

#### End-to-end / Use-case

- [ ] Execute admin governance flow: provision user -> change role -> deactivate account -> verify login/access behavior.
  Pass condition: Access changes take effect correctly and expected restrictions are enforced at next auth check.

#### Regression

- [ ] Re-test critical admin safeguards (self-delete block, role reassignment safety, active term switch).
  Pass condition: Guardrails remain intact and no destructive path bypass is possible.

#### Security / Authorization Negatives

- [ ] Attempt privilege escalation by tampering role payloads and token claims from lower-privileged sessions.
  Pass condition: Server-side authorization ignores client tampering and rejects forged privilege attempts.

#### Usability / Accessibility

- [ ] Validate high-impact admin screens (Users, Settings, Audit Log) for navigation clarity and keyboard access.
  Pass condition: Critical admin actions are discoverable, reversible where required, and operable without pointer lock-in.

#### Data Integrity

- [ ] Validate audit completeness after user, settings, and policy changes.
  Pass condition: Audit entries include actor, action, target entity, timestamp, and before/after detail where applicable.

#### UAT Signoff Check

- [ ] Admin sponsor validates governance controls and release operability.
  Pass condition: Sponsor signs off that policy, user lifecycle, and audit requirements are met.

### System/QA Observer

#### Integration

- [ ] Correlate UI actions to API logs and database effects for one critical flow per role.
  Pass condition: Each sampled flow has traceable request-to-persistence evidence with no orphan or hidden side effects.

#### End-to-end / Use-case

- [ ] Run cross-role smoke path in sequence (Applicant -> Registrar -> Teacher -> Administrator) on one shared dataset.
  Pass condition: Handoffs between roles succeed with no state loss or policy conflict.

#### Regression

- [ ] Execute targeted regression suite for all Severity 1/2 fixes in current release.
  Pass condition: 100% pass for release-blocking fixes, or approved exception with mitigation owner and due date.

#### Security / Authorization Negatives

- [ ] Run abuse pack (IDOR, direct endpoint access, stale token, session invalidation, rate-limit behavior).
  Pass condition: Controls trigger as designed and no exploitable authz/authn gap remains at Severity 1/2.

#### Usability / Accessibility

- [ ] Validate WCAG-focused critical paths and error comprehension across roles.
  Pass condition: No open Severity 1/2 accessibility blocker and critical error text is user-actionable.

#### Data Integrity

- [ ] Execute reconciliation checks for admissions, exam attempts, scores, and exported reports.
  Pass condition: Reconciliation variance for critical entities is 0, with evidence attached.

#### UAT Signoff Check

- [ ] Confirm signoff packet completeness for all role owners and release board.
  Pass condition: All required approvals, evidence links, and defect dispositions are present and time-stamped.

## 7) Evidence Package Required for Auditability

- Test run reports for each test type
- Defect log with severity, owner, root cause, and retest evidence
- Performance and resilience result summaries with raw metrics references
- Backup and restore execution records
- UAT signoff records
- Final go/no-go decision record with approver names and timestamp

