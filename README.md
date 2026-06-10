# QewOS

A website quality auditing platform. The web app (Next.js 15) lets users
queue audits; a separate BullMQ worker runs each audit — capturing
screenshots, pulling PageSpeed metrics, and scoring the page with an
AI judge.

## Running locally

### Prerequisites

- Node.js 20+
- A Postgres database
- A Redis instance

The easiest way to get Postgres and Redis is Docker:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=qewos postgres:16
docker run -d -p 6379:6379 redis:7
```

### Setup

```bash
# 1. Install dependencies (Puppeteer downloads its own Chrome here)
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env — see the comments in that file for what each var does

# 3. Create the database schema (there are no migrations; push the schema)
npm run db:push

# 4. Start the web app (http://localhost:3000)
npm run dev

# 5. In a second terminal, start the worker that processes audits
npm run worker
```

### What works with the minimal setup

With just Postgres, Redis, and the required vars in `.env`, the web UI,
email-and-password auth, and the database all work. Running an actual audit
additionally needs:

- the **worker** running (`npm run worker`)
- a real **`ANTHROPIC_API_KEY`** — the AI judge calls the Anthropic API
- **Cloudflare R2** credentials (`R2_*`) for the screenshot-upload step

See `.env.example` for the full list of variables and which are optional.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run worker` | Start the audit worker (watch mode) |
| `npm run worker:start` | Run the compiled worker |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:migrate` | Create and run a migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | Run ESLint |
