# Homepage hero logo dedupe · 2026-09-09

The homepage hero sat a second FixFlags mark under the marketing nav lockup. Other marketing pages already used the nav as the only page chrome brand.

## Result

- Removed the homepage hero `Logo` mark and `.heroMark` spacing so the headline is the first content under the nav.
- Left illustrative marks in the later AI-handoff steps and notification examples.
- Pricing, how-it-works, FAQ, and sign-in have no second chrome logo. Pricing still uses a 3D glass mark as hero artwork, not a second nav lockup.

## Verification

- Homepage Vitest: 15 passed, including a check that the hero has no `logo-mark`.
- Live Chromium at 1440 and 390: one visible header logo, headline first, no hero mark.
- Live HTML on `/pricing`, `/how-it-works`, `/faq`, `/sign-in`: header + footer chrome only.

No deployment.
