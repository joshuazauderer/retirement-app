# RetirePlan

Production retirement planning web application.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- PostgreSQL + Prisma ORM (v7 with pg adapter)
- Auth.js v5 (JWT sessions)
- Tailwind CSS + shadcn/ui

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)

### Setup

1. Clone the repo
2. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in values in `.env.local`
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
6. Seed the database:
   ```bash
   npx prisma db seed
   ```
7. Start the dev server:
   ```bash
   npm run dev
   ```

Demo account: `demo@retireplan.app` / `Password123!`

## Docker Build

```bash
docker build -t retirement-app .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e AUTH_URL="http://localhost:3000" \
  retirement-app
```

## Coolify Deployment

1. Push repo to GitHub
2. In Coolify, create a new Application
3. Connect the GitHub repo
4. Set environment variables:
   - `DATABASE_URL`
   - `AUTH_SECRET` (run `openssl rand -base64 32`)
   - `AUTH_URL` (your production domain)
   - `NODE_ENV=production`
5. Deploy

## Database Migrations (Production)

Add this to your Dockerfile CMD or as a pre-deploy hook:
```bash
npx prisma migrate deploy
```

## Project Structure

```
src/
  app/
    (auth)/         # Public auth pages
    (dashboard)/    # Protected app pages
    api/            # API routes
  components/       # Shared UI components
  lib/              # Auth, Prisma, validations
  services/         # Business logic layer
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script
  migrations/       # Migration files
```
