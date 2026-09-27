# Production migration status must be checked from the current migration tree

**Date:** 2026-09-25
**Scope:** Railway production PostgreSQL for the `FixFlags` service
**Confidence:** HIGH
**Evidence:** Production `npm run db:check` initially reported seven pending migrations and a database-only legacy marker; `npm run db:deploy` applied the seven migrations; the follow-up `npm run db:check` reported `Database schema is up to date!`; live `/api/health/ready` returned `ok: true` with all subsystems ready.

## Discovery

The active production image contained the migration tree through `20260921213000_one_active_outcome_run`, while `main` contained seven later migrations through `20260922200000_site_connections`. The failed `main` deployment never reached runtime, so its startup migration step had not run. Applying the current local migration tree through a Railway database tunnel updated production without replacing the running web image.

The production `_prisma_migrations` table also contains the historical database-only marker `20260723081407_scan_access` and two rolled-back historical migration records. Prisma status treats the repository migration tree as up to date; do not edit `_prisma_migrations` by hand.

## Why it matters

A production image can be healthy while its migration set is behind `main`. Migration deployment and code deployment are separate facts. Readiness and migration status must both be checked after a production change.

## Correct approach

1. Identify the live Railway service and environment before touching the database.
2. Use a Railway SSH tunnel for the private PostgreSQL service; `railway run` from a laptop cannot reach the private database host.
3. Run the production-safe `npm run db:check` first.
4. Apply only `npm run db:deploy`, then rerun `npm run db:check` and live `/api/health/ready`.
5. Never print raw Railway environment configuration; it contains production secrets. Pass variables into commands without echoing them.
6. Report the deployed application revision separately from the migration state. Never claim the latest code is live when its Railway deployment is failed or the health commit is older than `main`.

## Prevention encoded

The release workflow already treats `migrate deploy` as the production path and requires live health/readiness evidence. Keep migration status and exact deployed revision as separate release assertions.
