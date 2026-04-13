# Security Runbook

Date: April 13, 2026
Scope: Golden Key backend and frontend deployment protections

## 1. Security Objectives

- Block malformed input before controller logic.
- Limit abusive request bursts per endpoint and per client identity.
- Add edge-layer controls to withstand distributed high-volume traffic.
- Maintain dependency hygiene with repeatable audit checks.

## 2. Current In-App Controls

Backend protections currently implemented:
- Helmet headers enabled.
- CORS allowlist policy.
- Request body size limits for JSON and URL-encoded payloads.
- Global rate limiter plus endpoint-specific limiters.
- Zod validation middleware for auth, admissions, exams, results, academic-year, perf routes.
- RBAC authorization and JWT authentication.

Current notable limiter buckets:
- Global API: 300 / 15 min
- Auth routes: 20 / 15 min
- Upload routes: 30 / hour
- Exam registration: 10 / hour
- Result submission: 10 / hour
- Perf ingestion: 120 / minute
- Bulk operations: 10 / 15 min
- General writes: 30 / 15 min

## 3. Edge Protection (Required for Very High Traffic)

Application-level limiters alone do not stop large distributed attacks. Add an edge layer.

Recommended baseline:
- Cloudflare or equivalent WAF in front of origin.
- Bot management challenge on auth and write-heavy endpoints.
- IP reputation filtering and geo throttling if abuse is regional.
- CDN caching for static assets and anonymous GET routes.

### Suggested Nginx limits

```nginx
# Global request rate
limit_req_zone $binary_remote_addr zone=global_limit:10m rate=20r/s;

# Stricter auth burst limit
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

server {
  location /api/auth/ {
    limit_req zone=auth_limit burst=20 nodelay;
    proxy_pass http://backend_upstream;
  }

  location /api/ {
    limit_req zone=global_limit burst=100 nodelay;
    proxy_pass http://backend_upstream;
  }
}
```

## 4. Validation and Abuse-Test Checklist

Run these before release:
1. Invalid auth payloads return 400 with VALIDATION_ERROR.
2. Invalid perf payloads return 400 with VALIDATION_ERROR.
3. Auth endpoints return 429 after configured burst.
4. Perf ingest endpoint returns 429 after configured burst.
5. Unauthorized write routes return 401/403.

## 5. Dependency Security Process

Backend:
- Run: npm audit --omit=dev
- Patch non-breaking updates first.
- Track residual advisories requiring major-version upgrades.

Frontend:
- Run: npm audit --omit=dev
- Track unresolved advisories where no safe fix is available.

Review cadence:
- Weekly during active development
- Immediately before production release

## 6. Incident Playbook (Rate-Limit / Abuse Spike)

1. Detect
- Watch 429 spikes, auth failures, and request-per-second anomalies.

2. Contain
- Tighten edge/WAF rules first.
- Temporarily reduce app endpoint limits for attacked routes.

3. Protect Data and Availability
- Prioritize login, exam submission, and admissions endpoints.
- Deprioritize non-critical ingest endpoints if saturation appears.

4. Recover
- Revert temporary strict rules gradually.
- Keep postmortem notes: attack vector, blocked rates, response timeline.

## 7. Residual Risk Notes

- Some dependency advisories may remain when fixes require major upgrades.
- For unresolved frontend `xlsx` advisory, evaluate migration away from vulnerable package path or sandbox imports.
- Continue threat modeling for upload and document parsing paths.

## 8. Current Audit Snapshot (2026-04-13)

- Backend (`npm audit --omit=dev`): 0 high, 1 moderate
  - Remaining: `file-type` advisory, fix path is major upgrade to `22.x`.
- Frontend (`npm audit --omit=dev`): 1 high
  - Remaining: `xlsx` advisory with no safe auto-fix reported.

Remediation completed in this pass:
- Prisma chain patched to `6.19.3`.
- `socket.io-parser` patched to `4.2.6` in backend and frontend dependency trees.
- `path-to-regexp` patched to `8.4.0` in backend tree.
