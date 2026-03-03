# Deployment Plan

## GOLDEN KEY Integrated School of St. Joseph — Admission & Examination System

**Version:** 1.0  
**Date:** February 27, 2026  

---

## 1. Deployment Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                      │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Vercel     │  │  Railway /   │  │  PlanetScale  │  │
│  │  (Frontend)  │──│  Render (API)│──│  / Supabase   │  │
│  │   React SPA  │  │  Express.js  │  │   (MySQL/PG)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  CDN-cached       Auto-scaled       Managed DB          │
│  Static files     Containers        Auto-backups        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Development** | Local development | `http://localhost:5173` (FE), `http://localhost:3001` (BE) |
| **Staging** | Pre-production testing | `https://staging.goldenkey.edu` |
| **Production** | Live system | `https://goldenkey.edu` |

---

## 3. Prerequisites

### 3.1 Accounts Required

- [ ] **GitHub** — Source code (private repo)
- [ ] **Vercel** — Frontend hosting (free tier works)
- [ ] **Railway** or **Render** — Backend hosting
- [ ] **PlanetScale** (MySQL) or **Supabase** (PostgreSQL) — Database
- [ ] **Domain registrar** — `goldenkey.edu` / custom domain
- [ ] **Email service** — SendGrid or Resend (for password resets & notifications)

### 3.2 Local Development Tools

```
Node.js        >= 18.x
npm             >= 9.x
Git             >= 2.40
MySQL / PostgreSQL  (local dev — optional if using cloud DB)
```

---

## 4. Repository Structure

```
golden-key/
├── frontend/              # React + Vite + Tailwind (existing)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/               # Express.js + Prisma (to build)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── docs/                  # This documentation
└── README.md
```

**Recommendation:** Monorepo with two packages or two separate repos. Monorepo is simpler for a small team.

---

## 5. Environment Variables

### 5.1 Backend `.env`

```env
# Server
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Database
DATABASE_URL=mysql://user:pass@host:3306/goldenkey

# Authentication
JWT_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
FRONTEND_URL=https://goldenkey.edu

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=noreply@goldenkey.edu

# File uploads (optional — for document storage)
UPLOAD_MAX_SIZE=5242880
UPLOAD_DIR=./uploads
```

### 5.2 Frontend `.env`

```env
VITE_API_BASE_URL=https://api.goldenkey.edu
VITE_APP_NAME=GOLDEN KEY Integrated School of St. Joseph
```

---

## 6. Local Development Setup

### 6.1 Clone & Install

```bash
git clone https://github.com/org/golden-key.git
cd golden-key

# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 6.2 Database Setup

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your local DB credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npx prisma db seed
```

### 6.3 Start Development

```bash
# Terminal 1 — Backend
cd backend
npm run dev    # nodemon src/server.js

# Terminal 2 — Frontend
cd frontend
npm run dev    # vite dev server
```

---

## 7. Backend Deployment

### 7.1 Option A: Railway

1. Connect GitHub repo
2. Set root directory to `/backend`
3. Set environment variables in Railway dashboard
4. Railway auto-detects Node.js and runs `npm start`
5. Add custom domain: `api.goldenkey.edu`

**Build Command:** `npx prisma generate && npm run build` (if TypeScript)  
**Start Command:** `node src/server.js`

### 7.2 Option B: Render

1. Create new Web Service → connect GitHub
2. Root directory: `backend`
3. Build: `npm install && npx prisma generate`
4. Start: `node src/server.js`
5. Set environment variables
6. Add custom domain

### 7.3 Option C: Self-Hosted (VPS)

```bash
# On Ubuntu 22.04
sudo apt update
sudo apt install nodejs npm nginx certbot

# Clone and setup
git clone <repo> /opt/golden-key
cd /opt/golden-key/backend
npm install --production
npx prisma generate
npx prisma migrate deploy

# Use PM2 for process management
npm install -g pm2
pm2 start src/server.js --name golden-key-api
pm2 save
pm2 startup

# Nginx reverse proxy
# /etc/nginx/sites-available/api.goldenkey.edu
server {
    listen 80;
    server_name api.goldenkey.edu;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

# SSL
sudo certbot --nginx -d api.goldenkey.edu
```

---

## 8. Frontend Deployment

### 8.1 Vercel (Recommended)

1. Connect GitHub repo
2. Root directory: `frontend` (or `/` if standalone repo)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set `VITE_API_BASE_URL` environment variable
6. Add custom domain: `goldenkey.edu`

### 8.2 Netlify (Alternative)

Same as Vercel — connect repo, set build settings, add domain.

### 8.3 Build Configuration

[vite.config.js](../frontend/vite.config.js) — ensure `base: '/'` for custom domain.

---

## 9. Database Deployment

### 9.1 Option A: PlanetScale (MySQL)

1. Create database
2. Create `main` branch (production) and `develop` branch (staging)
3. Copy connection string → set `DATABASE_URL`
4. Push schema: `npx prisma db push`
5. Enable safe migrations via PlanetScale dashboard

### 9.2 Option B: Supabase (PostgreSQL)

1. Create project → copy connection string
2. Set `DATABASE_URL`
3. Run: `npx prisma migrate deploy`

### 9.3 Migration Strategy

```bash
# Create migration
npx prisma migrate dev --name add_new_field

# Deploy to production
npx prisma migrate deploy

# Reset (development only!)
npx prisma migrate reset
```

---

## 10. CI/CD Pipeline

### 10.1 GitHub Actions — Backend

```yaml
# .github/workflows/backend.yml
name: Backend CI/CD

on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: goldenkey_test
        ports: ['3306:3306']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd backend && npm ci
      - run: cd backend && npx prisma generate
      - run: cd backend && npm test
        env:
          DATABASE_URL: mysql://root:test@localhost:3306/goldenkey_test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Deploy step depends on hosting provider
      # Railway: uses railway CLI
      # Render: auto-deploys on push
```

### 10.2 GitHub Actions — Frontend

```yaml
# .github/workflows/frontend.yml
name: Frontend CI

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      # Vercel auto-deploys — this just validates the build
```

---

## 11. Security Checklist

### Pre-Launch

- [ ] HTTPS enforced on all endpoints
- [ ] CORS restricted to `goldenkey.edu` only
- [ ] JWT secrets are strong (64+ random chars)
- [ ] Refresh tokens use `httpOnly`, `Secure`, `SameSite=Strict` cookies
- [ ] Rate limiting on `/api/auth/*` (10 req/min per IP)
- [ ] Input validation on all endpoints (Zod schemas)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React auto-escaping + CSP headers)
- [ ] Passwords hashed with bcrypt (cost factor 12)
- [ ] No secrets in source code (`.env` in `.gitignore`)
- [ ] Error messages don't leak stack traces in production
- [ ] File upload size limits and type validation

### Post-Launch

- [ ] Automated daily database backups
- [ ] Log aggregation (Railway/Render built-in or external)
- [ ] Uptime monitoring (UptimeRobot — free tier)
- [ ] Error tracking (Sentry — free tier)
- [ ] Dependency vulnerability scanning (Dependabot)

---

## 12. Monitoring & Logging

### 12.1 Application Logging

```javascript
// Use winston or pino
import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

### 12.2 Health Check Endpoint

```
GET /api/health

Response:
{
  "status": "ok",
  "uptime": 12345,
  "database": "connected",
  "version": "1.0.0"
}
```

### 12.3 Key Metrics to Track

- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database query time
- Active users / sessions
- Exam submissions per hour (during exam days)

---

## 13. Backup & Recovery

### 13.1 Database Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Daily (2 AM) | 30 days |
| Point-in-time | Continuous | 7 days |
| Pre-migration | Before each deploy | Permanent |

### 13.2 Recovery Procedure

```bash
# 1. Identify the issue
# 2. If database corruption:
npx prisma migrate reset      # (staging only)
mysql -u root < backup.sql     # (production restore)

# 3. If bad deploy:
git revert HEAD
# Deploy reverted commit

# 4. Verify
curl https://api.goldenkey.edu/api/health
```

---

## 14. Scaling Considerations

### Phase 1 — Launch (Current)
- **Users:** ~100–500 (applicants per enrollment period)
- **Infra:** Single backend instance, managed DB
- **Cost:** ~$0–20/month (free tiers)

### Phase 2 — Growth
- **Users:** 500–2,000
- **Infra:** Scale backend vertically (more RAM/CPU)
- **Actions:** Add Redis for session caching, CDN for static assets

### Phase 3 — Institution-Wide
- **Users:** 2,000+
- **Infra:** Horizontal scaling, load balancer
- **Actions:** Database read replicas, background job queue (BullMQ)

---

## 15. Go-Live Checklist

### Week Before Launch

- [ ] All API endpoints tested manually & with automated tests
- [ ] Database seeded with initial admin/staff accounts
- [ ] CORS, HTTPS, and security headers configured
- [ ] Environment variables set on production servers
- [ ] Domain DNS configured (A record / CNAME)
- [ ] SSL certificates provisioned (auto via Vercel + Let's Encrypt)
- [ ] Email delivery tested (password reset flow)
- [ ] Backup job verified

### Launch Day

- [ ] Run `npx prisma migrate deploy` on production
- [ ] Verify health endpoint: `GET /api/health`
- [ ] Test login with admin account
- [ ] Test full admission flow (submit → status update)
- [ ] Test exam flow (register → take → submit → essay review)
- [ ] Monitor error logs for 1 hour
- [ ] Announce to users

### Post-Launch (Week 1)

- [ ] Monitor error rates daily
- [ ] Check database size growth
- [ ] Gather user feedback
- [ ] Plan first patch release
