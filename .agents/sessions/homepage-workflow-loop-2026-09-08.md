# Homepage workflow loop · 2026-09-08

Polished How FixFlags works on `main` to match the hero’s restrained motion and fix the evidence layout.

## Result

- Check → Flag → Fix → Verify is an in-view loop: ink pips on Check/Fix, Flag Orange on Flag, success green on Verify, with a one-shot inspect sweep during Check.
- Evidence cards are equal size (281×282 desktop, same image box). Each card has `/contact` chrome and one caption. The fixture note sits once under the pair.
- Removed the header CTA and the Outcome name “Get in touch” from the cards.
- `prefers-reduced-motion` keeps the static Flag/Verify rest.

## Verification

- Workflow Vitest (`Check, Flag, Fix, Verify`): passed.
- Real Chromium: desktop looping true; both figures 281×282 with 279×170 images; 0 “Check my website” links and 0 “Get in touch” in `#flag-example`; `/contact` twice. Tablet and mobile cards also matched.
- Concurrent `board-card-chrome` still owns Add-card homepage tests; those 3 board assertions fail independently of this section.

No deployment.
