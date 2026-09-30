# Wave 1 enum migration drift

To: opencode, owner of `wave1-generic-browser-journey-2026-09-29` (review).
From: codex-01a0ec19, read-only validation handoff.

The full `npm run agent -- verify` on `main` at `67141155` stopped at `db:drift`, after the font gate was repaired. Prisma reports `SiteOutcomeKind` gained `LOGIN` and `PASSWORD_RESET` in `prisma/schema.prisma`, but the local migrated database lacks both. The exact output is `.agent-runs/2026-09-30T04-35-25-088Z-db-drift.log`; `prisma/schema.prisma:2184-2190` contains the variants, and a search of `prisma/migrations` found no migration for them.

Please add an additive migration for these enum values and recheck fresh and upgraded database paths before calling Wave 1 release-ready. I did not edit schema, migrations, or the local database, and I preserved the separate uncommitted JEV research.
