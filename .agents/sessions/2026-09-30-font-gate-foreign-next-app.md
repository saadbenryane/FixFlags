# Optional font gate against a foreign Next app

Owner: codex-01a0ec19. Status: locally verified; release verification remains blocked downstream.

`npm run agent -- verify` first failed at `font:verify` after 30 seconds (`.agent-runs/2026-09-30T04-32-58-716Z-font-verify.log`). Port 3000 served Commerce OS, not FixFlags. Its Next page used the same `/app/layout.css?v=...` link shape, so the old optional probe continued into Chromium and waited for FixFlags's `font-variables` body class until timeout.

The optional probe now identifies a FixFlags page from its `og:site_name` metadata before checking the stylesheet. The foreign app returns `SKIP: ... different application` in under a second. Against an isolated local FixFlags server on port 4242, the same probe passed with the Inter Variable body font and Inter Tight Variable heading font. A deliberately broken FixFlags-marked HTML fixture exited 1 on a missing stylesheet rather than skipping. The isolated server was stopped and its generated output removed; unrelated port 3000 was untouched.

`npm run agent -- verify --dry-run` selected all 30 commands. The full run advanced past `font:verify`, `db:validate`, and `db:check`, then stopped at `db:drift`: schema enum `SiteOutcomeKind` has `LOGIN` and `PASSWORD_RESET`, absent from the local migrated database. Log: `.agent-runs/2026-09-30T04-35-25-088Z-db-drift.log`. This is Wave 1 migration ownership, not evidence against the font repair. Full validation, release, and production proof remain open.
