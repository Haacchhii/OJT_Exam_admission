# GoldenKey Application Baseline

Date: 2026-08-25

Branch: `codex/goldenkey-data-platform`

Baseline commit: `bdb0728`

## Purpose

This report captures the existing application's verification state before data
platform implementation. It records failures rather than modifying application
behavior, so later changes can be measured against a stable baseline.

## Environment

| Component | Observed state |
|---|---|
| Node.js | `v22.19.0` |
| npm | `10.9.3`, invoked directly because the machine-level npm shim is broken |
| Docker | Not installed or not available on `PATH` |
| Production database | Supabase PostgreSQL; not accessed during baseline |
| Local test database | Not available |

The repository documents Node 18+ and CI uses Node 20. A later verification run
should use Node 20 to match CI exactly. Node 22 was sufficient for the checks below.

## Backend

### Dependency installation

`npm ci` completed from `backend/package-lock.json`.

### Prisma generation

`npm run build` passed after Prisma downloaded its pinned Windows query engine.

### Tests

Command configuration used placeholder local-only values for `DATABASE_URL`,
`DIRECT_URL`, and `JWT_SECRET`. No production credentials were used.

Result:

- 8 of 9 test files passed.
- 67 tests passed.
- 4 database-backed production-flow tests could not run.
- `production-flows.test.js` failed during setup because no local PostgreSQL test
  database was available at the placeholder URL.
- Without placeholder configuration, three suites exit during module import
  because `src/config/env.js` calls `process.exit(1)` when required values are absent.
- Before Prisma generation, two suites also fail to import the generated client.

Interpretation: the isolated backend logic and security-guard tests are currently
green. The database-backed production flow is unverified, not demonstrated broken.
The suite is not self-contained on a clean clone because it requires manual
configuration, Prisma generation, and a populated database.

### Performance smoke test

`npm run perf:smoke` exited successfully but skipped all measurements because
`PERF_SMOKE_BASE_URL` was not set. No performance claim can be made from this run.
The workflow design supports authenticated endpoint thresholds when a target and
credentials are configured.

## Frontend

### Dependency installation

`npm ci` completed from `frontend-ts/package-lock.json`.

### Lint

`npm run lint` failed before inspecting source files. ESLint 9 could not find an
`eslint.config.js`, `eslint.config.mjs`, or `eslint.config.cjs` file. No legacy
`.eslintrc` file is present either.

Interpretation: linting is advertised in `package.json` but is not operational.
This should be fixed as a separate application-tooling change with an initial
baseline of the violations it reveals.

### Production build and bundle budget

`npm run build:ci` passed when run outside the restricted filesystem sandbox:

- TypeScript compilation passed.
- Vite transformed 871 modules.
- Production build completed in 13.67 seconds.
- Total JavaScript: 1,164.35 KB.
- Largest chunk: charts vendor, 361.84 KB.
- All configured bundle budgets passed.

The first sandboxed attempt failed because esbuild was denied access while resolving
the Vite configuration. The unrestricted success shows that was an execution
environment limitation rather than a source/build defect.

## Dependency advisory baseline

No automatic or forced upgrades were applied.

### Backend

`npm audit` reported 20 vulnerable dependency nodes:

- 1 critical
- 14 high
- 3 moderate
- 2 low

Direct dependencies in affected paths include `vitest` (critical), `multer`,
`nodemailer`, `prisma`, `socket.io-parser`, and `express-rate-limit`. Audit reports
fixes as available, but compatibility and actual application exposure must be
evaluated before upgrading.

### Frontend

`npm audit` reported 14 vulnerable dependency nodes:

- 11 high
- 2 moderate
- 1 low

Direct dependencies in affected paths include `react-router-dom`,
`socket.io-parser`, and `vite`. Compatibility and use-path exposure require review.

Audit severity alone does not prove exploitability. Runtime dependencies exposed to
untrusted input receive priority over development-only tooling, but the critical
test-runner advisory still needs removal from the development supply chain.

## Prioritized follow-up

1. Add a reproducible local PostgreSQL test service and deterministic test setup.
2. Add an ESLint 9 flat configuration, record violations, and fix them incrementally.
3. Triage direct production dependency advisories and upgrade in isolated commits.
4. Match local/CI Node versions through an explicit repository version file.
5. Establish a runnable local performance target before changing performance code.
6. Install or otherwise provide Docker before the local data-platform service task.

These are baseline findings, not part of the first data-platform configuration
implementation. Each behavior or dependency change requires its own verification
and commit.
