# Remote sandbox can run the full stack (no docker needed)

**Validated:** 2026-07-17 (claude, app-polish session)

Prior sessions assumed docker was the only way to get Postgres/Redis and
skipped live verification in the Claude Code remote sandbox. Wrong: the
sandbox image ships native binaries.

## Recipe

```bash
# Postgres 16 (initdb refuses root; use the postgres user)
mkdir -p /tmp/ff-pg && chown postgres:postgres /tmp/ff-pg
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/ff-pg/data -U postgres --auth=trust"
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/ff-pg/data -l /tmp/ff-pg/pg.log -o '-p 5432 -k /tmp' start"
psql -h /tmp -U postgres -c "CREATE USER fixflags WITH PASSWORD 'fixflags' SUPERUSER;"
psql -h /tmp -U postgres -c "CREATE DATABASE fixflags OWNER fixflags;"   # separate -c calls: CREATE DATABASE cannot run in a tx

redis-server --daemonize yes --port 6379 --dir /tmp/ff-pg

cp .env.example .env.local   # then set a real BETTER_AUTH_SECRET
npm run db:deploy && npm run db:seed
DEV_SIMULATE_BILLING=true npm run dev   # billing gates ON (else isDevUnlimitedScans bypasses them)
```

## Network facts (measured, not assumed)

- curl and Node fetch reach external HTTPS (agent proxy intercepts
  transparently; prod fixflags.com reachable, ~0.7s).
- **Chromium/Puppeteer HTTPS egress is blocked** (ERR_CONNECTION_RESET).
  `--proxy-server` does not help: plain-HTTP requests reach the proxy, CONNECT
  never does. Do not burn time on this again.
- Consequence: local audits of external sites fail at screenshot capture
  (exercises failure UX); localhost browsing with Puppeteer works fully; live
  prod pipeline can be exercised via curl (POST /api/checks + status polling).

## Hard-won testing lessons

- `window.history.replaceState` in a mount effect LOSES A RACE with the Next
  App Router's hydration history sync — the stripped query comes back on Back
  navigation. Guard one-shot auto-submits with sessionStorage instead, and
  verify history-sensitive behavior in a real browser, not by code reading.
- `psql -c "A; B"` wraps both statements in one transaction; CREATE DATABASE
  needs its own `-c`.
- Puppeteer scripts: run with `NODE_PATH=/path/to/repo/node_modules` to reuse
  the repo's puppeteer install.
