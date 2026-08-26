# Anon report chrome

Date: 2026-08-26.

Status: **done**.

`.agents/GOAL.md` was left to the concurrent `report-flag-evidence-ia` owner.
This session is the turn log for `anon-report-chrome`.

## Outcome sought

Signed-out Product Reviews use the same living-review chrome as signed-in completed reports.
Private actions open one signup/login dialog.
Agent conversations stay owner-only.
Anonymous submits reuse a public scan of the same URL from the last hour.

## Contract

- `owner`: signed-in owner. Chat loads and sends.
- `anonymous_teaser`: signed-out visitor whose cookie lists this unclaimed audit. Public Flags. Chat send opens save-report dialog. Never fetch conversation.
- `public_viewer`: anyone else looking at a public report (unclaimed without cookie, or owned public report). Signed-out send opens create-account dialog. Signed-in non-owner sees owner-lock composer.
- `share_grant`: legacy token. Same chat UX as public_viewer.
- `marketing_sample`: curated fixtures only. Never assigned to live `isPublic` creates.

Chat gate is session-shaped: no session → `sign-in`; session and not owner → `owner`; owner → `canChat`.

Last-hour reuse never calls `trackAnonymousAuditId` on a foreign audit.

## Proof

| Turn | Work | Proof | Verdict |
|------|------|-------|---------|
| 1 | Access contract, chrome, reuse, chat privacy | 152 focused tests; postgres last-hour reuse 7/7 | PARTIAL |
| 2 | Split `resolveReportChatGate` into `lib/audit/access-context.ts` so the client bundle does not import Prisma/`node:async_hooks` | `npx tsc --noEmit` clean; `/report/[id]` compiles | PARTIAL |
| 3 | Browser + agent gate | `npm run agent -- verify` passed (12 commands). Playwright 375/768/1280 on public example.com report `cmtaddaze000bgumgxkpk4gjj`: Sign up CTA, app rail, composer sign-in copy; send/history/Products/Copy open create-account; GET `/chat` 401; second anonymous POST `reused: true` with no `ff_anon_report_ids`. Screenshots in `.agents/artifacts/anon-report-chrome/`. | MET |

## Success criteria

- Signed-out scanning and completed reports show a brand Sign up CTA, not a text Log in link.
- Signed-out scanning and signed-in completed reports share the app left rail; signed-out Products/Settings/Billing open the dialog.
- Signed-out send/history/Copy open signup/login; composer is not the owner-lock string.
- Chat GET/POST never returns another user’s messages; report/status JSON has only scan Agent messages for non-owners.
- Anonymous POST `/api/checks` for a URL scanned in the last hour returns that public report (`reused: true`) without a new job and without writing a foreign id into `ff_anon_report_ids`.
- Failed own teaser remains retryable via cookie; failed reports now keep immersive chrome.

## Notes

- Client components import chat-gate types from `lib/audit/access-context.ts`. `lib/audit/access.ts` stays server-only (Prisma, entitlements).
- Header Sign up always opens create-account. Teaser history/send/Copy use save-report copy (`Get every fix prompt…`).
- FAILED scans are excluded from last-hour reuse by design. Use a URL that actually loads for reuse proof (`https://example.com/`).
- Concurrent `report-flag-evidence-ia` edits were preserved (`explorer-model` missing `buildFixList` import restored so `/report/[id]` could render).
