# Homepage hero voice · 2026-09-09

Hero copy and color, not the rest of the homepage. Flag Orange stays a signal. The brand promise stays ink.

## Decision

Do not paint “looked after.” in Flag Orange. Orange means Flag / attention / Analyze. The promise is calm care. The previous muted gray made the payload recede; both headline lines now use ink `rgb(12, 12, 14)`.

## Copy

From `docs/voice-and-copy.md`:

- Headline kept: Your website, looked after.
- Supporting: Keep building. FixFlags keeps watch.
- Proof: 100+ automated tests. Real browser journeys.
- CTA: Analyze
- Trust kept: No credit card required

SEO home description now matches monitoring + tests + journeys + Flag.

Board, workflow, 100+ section, AI, and close titles are unchanged. Those remain W4 / `homepage-end-user-polish` / `board-card-chrome`.

## Verification

- Homepage + SEO Vitest: 18 passed.
- Live Chromium 1440 and 390: ink headline, Analyze `rgb(255, 90, 0)`, no “Check my website” in the hero.
- Screenshots: `output/playwright/hero-voice-desktop.png`, `hero-voice-mobile.png`.

No deployment.
