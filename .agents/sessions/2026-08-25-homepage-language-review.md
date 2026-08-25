# Homepage language review

## Scope

This pass improves homepage comprehension before the canonical report workspace is refactored.
It does not fork or redesign the embedded report workspace.

## Decisions applied

- The hero explains the visitor outcome in plain language: what people miss, where they get stuck, and what to fix before sharing.
- The small offer line under the URL input is removed.
- The sample-review action is centered beneath the URL input.
- The hero assurance row contains only evidence from the submitted live site and three reviews included free.
- The anonymous homepage no longer says the report is private.
- The AI-editor logo label and marks have more vertical and horizontal breathing room.
- The curated Launchpad sample is explicitly identified as curated, never as a live customer report.
- The dark proof section now explains what the visitor receives: an issue, evidence, a fix prompt, and an update review.
- The following section explains what the visitor does: check the live product, fix the important issues, and check again.
- Message, Experience, and Reach are explained through user questions and carry visible rubric icons.
- Bright orange CTA buttons retain dark text because white on the current `#FF5A00` brand token does not provide enough contrast for normal-sized text.

## Deferred to the report refactor

- The embedded sample repeats Launchpad identity in the Agent and Product headers.
- The homepage must continue consuming the canonical shared report workspace instead of receiving homepage-only chrome.
- `ReportWorkspaceSplitShell` currently hides the completed Preview/Timeline surface through `hidePreviewPane = !scanning`.
- That August 23 behavior contradicts the curated Timeline test and the design-system contract that repository samples may replay their versioned static Timeline fixture.
- The next report pass should decide the single mature identity treatment and restore one coherent completed Report/Timeline navigation model.

## Proof

- `npx tsc --noEmit --incremental false`
- `npx eslint` on every changed TypeScript and TSX file
- Focused homepage copy tests pass.
- Playwright rendered the full homepage at 1440 by 1000 and 390 by 844 with zero page errors and no horizontal overflow.
- The centered sample link measured a zero-pixel center delta from the audit form at both widths.
- The focused homepage component suite retains one pre-existing report Timeline failure described above.
