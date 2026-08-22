# Lean Product and Review experience

## Decision

Product remains the durable long-term dashboard.
Each Product Review is a complete observation opened in the canonical Review workspace.
Report and Timeline are URL-backed sibling views.
AI is an internal capability, not a separate customer-facing report type.

The generic Product identity in the Product-pane header is replaced in Report mode by an explicit Score and chronological Review history.
The redundant Critical shortcut, verdict summary, and next-step sentence are removed because the ranked explorer already owns that information.

Repository-owned samples may expose their complete static Timeline without authentication.
Live anonymous, token-share, and non-owner report serialization remains redacted.

## Ownership reconciliation

`game-on-product-loop` had no session handoff, live task-tree agent, or working-tree changes and had not been updated since 2026-08-13.
The approved plan supersedes and absorbs its Product workspace requirements.
Release scripts, Prisma/judgment ledger, analytics, and unrelated scopes remain separately owned and out of bounds.

## Acceptance evidence

- Score and each historical Review are understandable and keyboard reachable.
- Selecting history opens the full canonical Review and survives Back/Forward.
- Samples replay complete versioned static observations without leaking live protected payloads.
- Product actions start, resume, or update the right Review through the canonical APIs.
- All changed states are exercised at 375, 768, and 1280 pixels with console, accessibility, and clipping inspection.
- Focused contract checks and the full local verification gate pass before the goal can be marked met.

## Implementation result

- One default-deny workspace capability model now controls Timeline, chat, Canvas, prompts, sharing, and update reviews.
- Product identity, Score, chronological full-Review links, view controls, Agent, transport, ranked Flags, evidence, and fixes use the canonical workspace and pane compositions.
- Manual Review creation uses a Product-scoped PostgreSQL advisory lock and returns the persisted parent when an active Review is reused.
- Product state distinguishes active, latest, latest-completed manual Reviews, and Watch, with cursor-backed unified history and exact evidence provenance.
- The public sample contains two immutable repository-owned observations with distinct Playwright captures, hashes, evidence anchors, scores, Flags, and Timeline data.
- The deleted observation endpoint, score ring, partial history switching, duplicate Product spine, and duplicate homepage report frame did not receive compatibility replacements.

## Verification result

- `npm run agent -- verify`: PASS, 27 commands including database drift, typecheck, lint, guards, 4,569 unit tests, coverage, accuracy, production web/worker builds, and Docker image.
- `npm run verify`: PASS with the same full manifest and Railway-equivalent image.
- Chromium, Firefox, and WebKit workspace matrix: 15/15 PASS at the required widths and accessibility states.
- Report pane proof: PASS at 320, 375, 768, and 1280 pixels with inspected inset comparison frames.
- `npm run agent -- eval ui`: PASS against the isolated production build.
- `npm run agent -- eval release`: correctly BLOCKED at the foundation receipt because `RELEASE_FRESH_DATABASE_URL`, `RELEASE_ALLOW_DATABASE_RESET`, `RELEASE_CONTAINER_ENV_FILE`, and `RELEASE_SMOKE_URL` are not configured.

Production deployment was separately authorized on 2026-08-22.
The five-person uncoached comprehension study remains external human validation and must not be represented by synthetic participants.

## Production result

- Main commit: `5cb18af22b67fe56decf5f6e282992485a6bd99e`.
- Railway QewOS deployment `8ccaad86-f558-46ce-b824-d22f05841c37`: SUCCESS.
- Railway FixFlags Worker deployment `8b72df82-2336-4340-9255-3cfa8f7b09ec`: SUCCESS.
- `https://fixflags.com/api/health` reports commit `5cb18af`, database ok, AI configured, storage configured, billing configured, email configured, and Product Watch available.
- `https://fixflags.com/api/health/ready` reports `ok: true` with no missing database, Redis, worker, browser, storage, AI, PageSpeed, auth, billing, email, or Product Watch subsystem.
- Production Chromium, Firefox, and WebKit workspace matrix: 15/15 PASS.

The implementation and production release are closed.
Credentialed destructive-fixture release receipts remain unavailable because the required dedicated release resources are absent.
The uncoached five-person study remains a separate human research gate before claiming the design itself validated.
