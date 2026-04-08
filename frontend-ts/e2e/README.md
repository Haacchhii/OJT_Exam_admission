# E2E Critical Journeys (Playwright)

## Scope
These tests cover high-risk journeys:
- Authentication and role routing
- Student exam access path
- Registrar admissions detail flow
- Teacher bulk import exams modal open/close safety

## Pre-requisites
1. Backend running (default `http://localhost:3000`)
2. Frontend running (default `http://127.0.0.1:5173`)
3. Seeded test data in backend (`admin@goldenkey.edu`, `teacher@goldenkey.edu`, `registrar@goldenkey.edu`, `joseirineo0418@gmail.com`)

Default credentials used by tests:
- admin@goldenkey.edu / admin123
- teacher@goldenkey.edu / Admin123!
- registrar@goldenkey.edu / Admin123!
- joseirineo0418@gmail.com / Changeme123!

## Install
- `npm install`
- `npm run e2e:install`

## Run
- `npm run e2e`
- `npm run e2e:headed`
- `npm run e2e:ui`

## Notes
- Set custom frontend URL with `E2E_BASE_URL`, e.g.:
  - PowerShell: `$env:E2E_BASE_URL='http://localhost:4173'; npm run e2e`
