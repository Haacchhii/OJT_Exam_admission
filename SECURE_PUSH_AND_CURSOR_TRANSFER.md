# Secure Push And Cursor Transfer (PowerShell)

Run these commands from the repository root:

```powershell
Set-Location "c:/Users/Jose Iturralde/Documents/1GoldenKey 2nd week/golden-key-react"
```

## 1) Rotate exposed secrets first

If any real credentials were ever visible in local files, rotate them now:

1. Supabase database password
2. JWT secret
3. SMTP password/app password

Then update your local `backend/.env` with new values.

## 2) Verify no secret files are tracked

```powershell
git ls-files | Select-String -Pattern "(^|/)\.env($|\.)|\.pem$|\.key$|id_rsa|credentials|secret"
```

Expected: only example/template files such as `.env.example`.

## 3) If any secret file is tracked, untrack it before commit

```powershell
git rm --cached backend/.env
git rm --cached frontend/.env
git rm --cached frontend-ts/.env
```

Run only for files that actually appear in `git ls-files`.

## 4) Quick content scan for accidental hardcoded secrets

```powershell
git grep -nE "DATABASE_URL=|DIRECT_URL=|JWT_SECRET=|SMTP_PASS=|API_KEY=|SECRET=|TOKEN="
```

Review results and remove real values if found.

## 5) Commit and push safely

```powershell
git add .
git status
git commit -m "chore: harden repo for safe GitHub transfer"
git push origin main
```

## 6) Open the same repo in Cursor

If Cursor CLI is installed:

```powershell
cursor .
```

If Cursor CLI is not installed:

1. Open Cursor manually.
2. Choose "Open Folder".
3. Select `c:/Users/Jose Iturralde/Documents/1GoldenKey 2nd week/golden-key-react`.

## 7) Optional: if secrets were committed in old history

If a secret ever entered git history, rotate it and rewrite history before sharing publicly.

```powershell
# Requires git-filter-repo installed
git filter-repo --path backend/.env --invert-paths
git push --force-with-lease origin main
```

Only do this if the file existed in commit history.