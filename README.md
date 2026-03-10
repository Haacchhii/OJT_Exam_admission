# Golden Key Integrated School — Online Exam & Admission System

A full-stack web application for managing entrance exams and student admissions.

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React 18 · Vite · Tailwind CSS v4      |
| Backend  | Express 5 · Prisma ORM · JWT           |
| Database | Supabase PostgreSQL                     |
| Security | Helmet · CORS · Rate Limiting · bcrypt  |

## Project Structure

```
├── frontend/   # React SPA (Vite + Tailwind CSS v4)
│   ├── src/
│   ├── .env.example
│   └── package.json
├── backend/    # Express API (Prisma + JWT)
│   ├── src/
│   ├── prisma/
│   ├── .env.example
│   └── package.json
└── README.md
```

## Local Development

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Supabase** project (free tier works)

### 1. Clone & install

```bash
git clone <repo-url> && cd golden-key-react

# Backend
cd backend
cp .env.example .env   # ← fill in your Supabase credentials & JWT_SECRET
npm install

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Set up the database

```bash
cd backend
npx prisma migrate dev   # creates tables & generates client
npx prisma db seed        # (optional) seed demo data
```

### 3. Start both servers

```bash
# Terminal 1 — Backend (port 3000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` to the backend.

---

## Production Deployment

The app is designed as a **single-server deployment** — the Express backend serves both the API and the React SPA.

### 1. Build the frontend

```bash
cd frontend
npm ci
npm run build   # outputs to frontend/dist/
```

### 2. Prepare the backend

```bash
cd backend
npm ci
npm run build   # runs prisma generate
```

### 3. Set production environment variables

```bash
NODE_ENV=production
DATABASE_URL=<supabase-pooler-url>
DIRECT_URL=<supabase-direct-url>
JWT_SECRET=<long-random-string>      # e.g. openssl rand -base64 48
CORS_ORIGIN=https://your-domain.com
PORT=3000
```

### 4. Run database migrations

```bash
cd backend
npm run db:deploy   # prisma migrate deploy (safe for production)
```

### 5. Start the server

```bash
cd backend
npm start   # NODE_ENV=production node src/index.js
```

The server serves the React SPA from `frontend/dist/` and handles all `/api/*` routes.

### Deploy to Render / Railway

| Setting       | Value                                |
| ------------- | ------------------------------------ |
| Build Command | `cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build && npm run db:deploy` |
| Start Command | `cd backend && npm start`            |
| Root Dir      | `.` (repo root)                      |
| Node Version  | 18+                                  |

Set all environment variables from step 3 above in the platform's dashboard.

---

## Available Scripts

### Backend (`cd backend`)

| Script           | Description                            |
| ---------------- | -------------------------------------- |
| `npm run dev`    | Start with nodemon (hot reload)        |
| `npm start`      | Start production server                |
| `npm run build`  | Generate Prisma client                 |
| `npm run db:migrate` | Create a new migration (dev)       |
| `npm run db:deploy`  | Apply migrations (production)      |
| `npm run db:seed`    | Seed demo data                     |
| `npm run db:studio`  | Open Prisma Studio (GUI)           |

### Frontend (`cd frontend`)

| Script           | Description                            |
| ---------------- | -------------------------------------- |
| `npm run dev`    | Start Vite dev server                  |
| `npm run build`  | Build for production                   |
| `npm run preview`| Preview production build locally       |

---

## API Health Check

```
GET /api/health → { "status": "ok", "uptime": 123.45 }
```

## Roles

| Role          | Access                                         |
| ------------- | ---------------------------------------------- |
| administrator | Full system access                             |
| registrar     | Admissions, user management                    |
| teacher       | Exams, results, grading                        |
| applicant     | Submit applications, take exams, view results  |
