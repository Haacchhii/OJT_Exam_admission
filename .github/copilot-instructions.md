# Copilot Testing Focus (Golden Key)

## Default Test Strategy
- Prioritize stakeholder workflow validation over endpoint accessibility scans.
- Start from real role login and navigate through each role's actual UI paths.
- Confirm pages render correctly and user can complete key actions.
- Treat expected-deny permissions as pass criteria for restricted pages.

## When User Asks For Testing
- Prefer these first:
  - Frontend E2E navigation and journey tests (`frontend-ts/e2e/tests/*`)
  - Role-based workflow checks (student, registrar, teacher, administrator)
  - State-aware validations (for example exam scheduled vs started vs done)
- Use endpoint-level scan tests only when explicitly asked, or as secondary diagnostics.

## Reporting Expectations
- Report by stakeholder impact first, not by endpoint list.
- Distinguish:
  - product defect,
  - data/setup precondition gap,
  - test fragility.
- Include concrete next actions in execution order.
