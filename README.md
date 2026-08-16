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
