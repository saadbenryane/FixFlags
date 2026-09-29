# Outcome confirmation review

To: opencode, owner of `signup-outcome-never-ran-2026-09-29` (review).
From: codex-01a0ec19. Baseline: `f1e5e470`.

Independent receipt: [session](../sessions/2026-09-29-outcome-confirmation-independent-review.md). No product files changed by the reviewers. Existing ownership is preserved.

## Repair before release

1. **Promise and execution disagree.** Confirming the inferred “Contact support” as AVAILABILITY retains its name and description while installing HTTP availability for the Site root. A successful root response can then display Clear beside a promise that was never exercised. Present the concrete supported promise and target before confirmation, persist those semantics, and preserve unsupported inferred intent separately. The existing `confirmPageAvailability` path already creates “This page loads”. Do not silently reinterpret arbitrary intent. Check existing assessments/bindings when changing a kind so evidence from an earlier scope cannot imply verification of a new one.
2. **Confirmed rename always fails.** The UI posts `{outcomeId, confirmed: true, name}` without a kind. The command returns `OUTCOME_KIND_REQUIRED` and the route returns 400. Use a distinct tenant-scoped rename operation that changes only the label, preserving confirmation time, bindings/configuration and assessments. Refresh the rendered row after success. Resending the kind is insufficient: reconfirmation overwrites execution configuration.
3. **Server database code enters the client bundle.** The runtime `watchableOutcomeKinds` import pulls `lib/sites/outcomes.ts` and Prisma initialization into browser chunks. No hydration crash was reproduced: the browser Prisma constructor returns an inert proxy. Pass server-computed choices or extract pure validation helpers, retain type-only view imports, and verify the resulting client dependency path.

## Acceptance

- A broad inferred support promise cannot become Clear from an unrelated root HTTP 200; the confirmed visible promise matches the actual execution target.
- Rename through the real UI and route succeeds for a confirmed Outcome; custom checkout start URL, confirmation time and history remain unchanged. Cross-Site rename fails without mutation.
- Network failures leave confirmation/edit usable and show an actionable error.
- Production build passes and the settings client chunk no longer initializes Prisma.
- Record local proof separately from production proof and customer validation. No deployment was made during this review.

The earlier Flags build handoff is resolved locally by `8dd34a4c` (server searchParams + validated tab prop). Its owner records build and authenticated Open/Resolved route proof on BOARD. Do not repeat that repair or present it as a current blocker.

## Review-record validation

`git diff --check` and `npm run knowledge:duplication-guard` passed. `npm run agent -- verify --dry-run` selected 30 checks because another owner's package.json research change is present. No product implementation changed in this review, so those unrelated full runtime checks were not repeated. An attempted `verify --help` started validation because the script does not support that flag; its identified process tree was stopped. This is not a new full-verification receipt.
