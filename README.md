# Personal Productivity Planner

A full-stack web application designed for personal use (and a few friends) to manage weekly learning plans, system design studies, DSA log entries, and Pomodoro timers.

## Tech Stack
- **Frontend:** React (Vite) + CSS Custom Properties (Vanilla CSS)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT-based signup/login

## Quick Start

### 1. Database Setup
Ensure Docker is running, then start the PostgreSQL database:
```bash
docker compose up -d
```

### 2. Backend Setup
1. Navigate to `/server`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` (configure your connection details if different)
4. Run Prisma migrations and client generation:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the server in development mode:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to `/client`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React client:
   ```bash
   npm run dev
   ```

## Deploying (free)

The app runs as one Render web service: Express serves the API and the built React app. Data lives in a free Neon Postgres.

1. **Database:** create a free project at [neon.tech](https://neon.tech) (region: Singapore). Copy the connection string (`postgresql://...?sslmode=require`).
2. **App:** at [render.com](https://render.com), choose **New → Blueprint**, pick this repo, and paste the Neon string as `DATABASE_URL`. `render.yaml` handles the build, start, `JWT_SECRET`, and `TZ=Asia/Kolkata`.
3. **Reset emails (optional):** create a free [Resend](https://resend.com) account with the same email you log in with. Add its API key as `RESEND_API_KEY` in Render. Without it, password and PIN reset codes are printed in the Render logs.

The schema is applied on every start with `prisma db push`, which refuses changes that would drop data.

The free Render service sleeps after 15 minutes idle, so the first visit afterwards takes about a minute to wake it.

### Copy local data to Neon (optional)

```bash
pg_dump --data-only --no-owner "postgresql://postgres:postgres@localhost:5432/productivity_planner" > data.sql
psql "<neon connection string>" -f data.sql
```

Run the dump after the first deploy has created the tables.
