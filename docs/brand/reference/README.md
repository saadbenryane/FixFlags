---
status: supporting
authority: interface
reviewed_at: 2026-10-11
supersedes: []
---

# Brand reference assets

These files preserve original owner artwork and historical visual references. They are not served at runtime and do not define current product styling. [DESIGN.md](../../../DESIGN.md) owns visual conventions; [SOUL.md](../../../SOUL.md) owns personality.

## Original identity sources

- `logo-mark-source.jpg` is the owner's original folded-F mark. Preserve it. The cleaned vector trace in `public/brand/logo-mark.svg` removes the JPEG fringe and supplies runtime sizes through `npm run brand:icons`.
- `logo-lockup-source.jpg` preserves the owner's flattened lockup. It is source artwork, not a logo for light surfaces.
- `brand-sheet-2026-07.png` and `ui-kit-v2.png` preserve the original identity and historical UI treatment. Their palette and layout recipes do not override current tokens or components.
- `logo-lockup-on-ink.png` is an earlier identity reference.

## Historical homepage artwork

The July homepage mockups and glass-hero exports record earlier compositions. Preserve the original `home-hero-glass-rgba-master.png` with its transparency; flattened chat/JPEG exports are not substitutes for an alpha source. The current homepage renders shared Site components and captured sample evidence, not the old glass hero.

## Production sources

| Role | Source |
| --- | --- |
| Runtime mark and wordmark | `public/brand/logo-mark.svg` and `components/brand/Logo.tsx`; vector-derived PNGs remain available for email and OG consumers |
| OG mark | `lib/design/logo-mark.tsx`, which embeds the official PNG for Node/Satori consumers |
| CSS palette and visual values | `lib/design/tokens.css` |
| Non-CSS brand palette | `lib/design/brand-spec.ts` |
| Fonts | `lib/design/fonts.ts` and self-hosted font imports in `app/layout.tsx` |

Use executable sources for exact values. Do not copy historical hex tables into new documentation or components.
