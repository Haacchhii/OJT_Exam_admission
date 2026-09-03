# Cross-Role Realtime Audit — September 3, 2026

## Scope

This slice reviewed authenticated applicant middleware and Socket.IO room authorization at the
boundary between applicant, teacher, registrar, and administrator workflows.

## Findings and remediation

- **Fixed:** applicant HTTP authentication referenced `cached` without importing it. A valid,
  active applicant token could therefore be returned as `UNAUTHORIZED` before the request reached
  its route. A regression test now proves the request continues and schedules status sync.
- **Fixed:** Socket.IO trusted role and account state embedded in the JWT. A demoted, disabled,
  deleted, password-gated, unverified, or token-revoked account could retain stale room access.
  Socket authentication now loads current account state and joins rooms using the database role.
- **Scope classification:** the authoritative April gap report explicitly de-scopes proactive
  notification creation. The current system offers realtime event toasts and email preferences,
  but it has no persistent notification inbox/read-state model. Those items remain an accepted
  limitation unless the product scope is expanded.
- **Deployment limitation:** Socket.IO is disabled in the Vercel serverless runtime. The security
  correction protects environments where sockets are enabled; production realtime delivery still
  requires a stateful Socket.IO host or a managed realtime service.

## Verification

- New realtime authorization suite: 6/6 passed.
- Focused applicant/admin/realtime suites: 29/29 passed.
- Broad isolated backend suite: 131/132 passed in parallel. The sole failure was the existing
  250 ms Redis timeout timing flake; it passed alone in 120 ms.
- Frontend ESLint: passed with 0 errors and 75 pre-existing warnings.
- Frontend production build: passed (871 modules transformed).

## Remaining cross-role work

- Exercise role handoffs against valid deployed test accounts.
- Verify email role defaults and per-user overrides with an SMTP test sink.
- Decide whether persistent notification creation/read state is still intentionally out of scope.

