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


You are working on a React + TypeScript SPA (Vite) with a Node.js + Express backend.
A core architectural rule of this codebase is:

  *** NO feature, change, or fix should ever require the user to manually
      refresh the page to see its effect. ***

Enforce this rule across all five layers below. When writing or modifying any
code, audit it against every applicable layer before submitting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1 — AUTH & ROUTE ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- AuthContext is the single source of truth for the current user, role, and
  session state. Never read auth from localStorage/sessionStorage directly
  inside components — always consume AuthContext.
- After login, logout, or a role change, AuthContext must update its state
  immediately (setState / useReducer dispatch). React will re-render all
  consumers automatically — do NOT call window.location.reload() or
  window.location.href = ... to force a refresh.
- Route guards and permission checks must be derived reactively from
  AuthContext state so that protected pages appear or disappear the moment
  context changes, with no full-page reload.
- If a token refresh or session expiry occurs mid-session, update AuthContext
  in place and redirect via React Router — never reload the page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 2 — DATA SCREENS & MUTATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Every create / update / delete operation must emit a data-change event
  via the app-wide event bus immediately after the API call resolves
  successfully.
- useAsync (the custom async hook) must listen for these events and trigger
  a re-fetch or cache invalidation automatically. No component should need
  a manual reload trigger.
- After a mutation in any screen (AdmissionList, Dashboard, etc.), the
  relevant list or detail view must reflect the new data within the same
  render cycle that follows the successful API response — no page refresh,
  no manual "reload" button required.
- If optimistic updates are used, roll them back cleanly on error without
  a reload.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 3 — REAL-TIME / SOCKET UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- SocketContext owns the socket connection. All components subscribe via
  SocketContext — never create a raw socket connection inside a component.
- When a socket event arrives (e.g. admissions status change, exam schedule
  notice), the receiving handler must update React state or emit an
  app-wide data-change event so useAsync re-fetches the affected data.
- Socket reconnection must be handled silently and automatically. If the
  socket drops and reconnects, any missed updates must be reconciled via
  a re-fetch — never ask the user to refresh.
- Do not store socket payloads only in a ref or a module variable;
  always flow them into React state so the UI re-renders.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 4 — UI / SESSION PREFERENCES & DRAFTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Any preference or draft written to localStorage or sessionStorage must
  also be reflected immediately in the React state/context that owns that
  preference — write to storage AND setState in the same operation.
- Components must read preferences from React state, not by calling
  localStorage.getItem() on every render. Hydrate once on mount into state,
  then keep state as the live source.
- Changes to theme, language, layout, or form drafts must apply instantly
  across all open components without a reload.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 5 — NEW PAGES & COMPONENTS (THE "NEW PAGE" CHECKLIST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every new page or component must be checked against all of the following
before it is considered complete:

  [ ] Auth/permission state is consumed from AuthContext, not read raw.
  [ ] Any data fetched uses useAsync (or equivalent) with cache-key
      registration so data-change events can trigger a re-fetch.
  [ ] If the page shows data that can be mutated elsewhere, it subscribes
      to the relevant data-change event or socket event.
  [ ] No window.location.reload(), location.href assignments, or hard
      navigations are used to "refresh" data.
  [ ] Preferences or drafts relevant to this page are hydrated from
      storage into state on mount, then read from state thereafter.
  [ ] On unmount, all event listeners and socket subscriptions are
      cleaned up to prevent stale updates or memory leaks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNED PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Never use any of the following to propagate a state change:
  ✗  window.location.reload()
  ✗  window.location.href = window.location.href
  ✗  location.replace(location.href)
  ✗  <meta http-equiv="refresh" ...>
  ✗  Instructing the user to "refresh the page" in any UI copy or toast

If you find yourself reaching for any of the above, stop and instead:
  → Update the relevant Context or local state.
  → Emit a data-change event so useAsync re-fetches.
  → Use React Router's navigate() for redirects.