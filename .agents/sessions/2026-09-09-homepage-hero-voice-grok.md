# Homepage hero voice · 2026-09-09

Hero copy, color, and Analyze button. Not the rest of the homepage. Flag Orange stays a signal. The brand promise stays ink.

## Decision

Do not paint “looked after.” in Flag Orange. Orange means Flag / attention / Analyze. The promise is calm care. Both headline lines use ink `rgb(12, 12, 14)`.

## Copy

Headline kept: Your website, looked after.

“Keep building. FixFlags keeps watch.” repeated the promise and did not say what the product does. Owner follow-up: keep the light feel, make the job obvious.

- Subtitle: Keep building. FixFlags monitors your live website and lets you know when a Flag matters.
- Proof: 100+ automated tests. Real browser journeys.
- CTA: Analyze
- Trust: No credit card required

SEO home description matches monitoring + tests + journeys + Flag.

## Analyze button

Landing submit uses a 3-column grid: empty | label | arrow. Analyze is geometrically centered (`labelOffsetFromCenter: 0`). The arrow sits on the right edge (`arrowFromRight` equals padding). Horizontal padding is `16px` on desktop, about 30% less than the previous `24px`. Desktop min-width is `10.5rem` so the arrow does not sit on the word.

## Verification

- Homepage + AuditInput Vitest: 25 passed.
- Live Chromium 1440: centered Analyze, 16px padding, 25px gap to the right-edge arrow. 390: full-width button, same layout.
- Screenshots: `output/playwright/hero-clarity-desktop.png`, `analyze-button.png`.

Board, workflow, 100+ section, AI, and close titles are unchanged. Those remain W4 / `homepage-end-user-polish` / `board-card-chrome`.

No deployment.
