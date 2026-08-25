# Public reports and Copy link

Date: 2026-08-25.

## Outcome

Every new Product Review now persists with `isPublic: true`.
Migration `20260825220000_public_reports_by_default` changes the database default and backfills every existing report to public.
The report toolbar no longer renders the Share drawer or any public/private toggle.
Export now contains a `Report link` action that copies the canonical `/report/{id}` URL.
Comparison sharing now copies the canonical `/compare/{id}` URL without creating a protected token.
New protected-link creation and management routes were removed.
Legacy `/share/[token]` reads remain available so previously issued links do not break.
Non-owner viewers receive report score, Flags, screenshots, and public-safe evidence only.
Agent chat, fix prompts, Product Memory, account history, update reviews, and export remain server-gated.

## Proof

The public-report migration applied successfully to the local development database.
`npm run db:validate`, `npm run db:check`, and `npm run db:drift` passed.
The focused Vitest set passed 43 tests, including the new canonical report-link clipboard assertion.
Targeted ESLint and `npx tsc --noEmit --pretty false` passed.
`npm run ui:drift-guard` passed.
`npm run font:verify -- --optional` passed twice after the verifier was made resistant to ongoing application network traffic.
An anonymous Playwright browser opened `/report/cmt1q68sm0007onnxedjvujf0`, rendered the completed report evidence, and kept Agent chat disabled for the non-owner.
The complete unit suite passed 4,625 tests and failed only eight concurrent sample-fixture and deep-review catalog assertions unrelated to this task.

## Remaining repository failures

`npm run agent -- verify` reaches `completeness:audit` and fails because published sample observations reuse materially identical desktop and mobile captures.
`npm run test:scripts` reports the same sample capture mismatch in two assertions.
`npm run test:unit` also reports the same sample fixture failures plus two concurrent documentation-catalog assertions for the removal of `/docs/deep-review`.
The anonymous browser proof logged two pre-existing localhost-versus-127.0.0.1 screenshot CSP errors for stored capture URLs.
