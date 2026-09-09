# Homepage hero motion · 2026-09-08

Replaced the 2px looping-style board scan with a one-shot inspection sequence on `main`. Copy, URL submission, BoardCard contract, and Flag page behavior were not changed.

## Result

- Headline first line stays paintable for LCP; the second line, body, and URL entry arrive on a short stagger.
- The example board arrives, a luminous veil inspects it (horizontal on desktop, vertical on mobile), and cards resolve in the sweep's wake.
- Status reads Checking until the pass finishes, then Checked just now. The Conversion Flag gets a one-shot orange ring, then rest.
- `prefers-reduced-motion` keeps the completed board and hides the sweep. No idle loop.

## Verification

- Homepage Vitest: 13 passed.
- Scoped ESLint on the TSX/test/copy files: no errors.
- Real Chromium frames at 1440 (80ms, 420ms, 900ms, 1400ms, 1950ms, 2600ms), 390, and reduced-motion: sequence matched the inspection story; rest state showed Checked just now.
- A later interaction pass against the shared `next dev` failed because `.next` was being rewritten by concurrent processes (`routes-manifest.json` missing). Card click/dialog behavior is unchanged in code and covered by existing homepage tests.

No deployment.
