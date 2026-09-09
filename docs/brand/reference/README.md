Reference images for the FixFlags brand (logo mockups, UI kit, brand sheet).

These are **design references only** — not served at runtime. Production assets live in `public/brand/` and `lib/design/`.

## Current sheet (2026-07)

- `brand-sheet-2026-07.png` — full brand guidelines (logo, palette, type, UI, dark mode)
- `logo-mark-source.jpg` — owner hi-res mark (square). Do not edit; derive runtime sizes with `npm run brand:icons`.
- `logo-lockup-source.jpg` — owner hi-res mark + wordmark lockup. Same rule.
- `logo-lockup-on-ink.png` — earlier mark + wordmark on ink (historical)

## Homepage mockups (2026-07)

- `homepage-hero-mockup.png` / `homepage-hero-mockup-v2.png` — hero composition reference
- `homepage-sample-report-mockup.png` — sample report section reference
- `home-hero-glass-rgba-master.png` — true RGBA export (preferred). `home-hero-glass-png-master.png` is the runtime-cropped/despilled plate.
- Do not rely on chat image uploads for hero art; they often flatten to JPEG-on-black.

Runtime hero glass: `public/marketing/visuals/home-hero-glass.webp` (RGBA).

## Production mapping

| Reference | Production |
|-----------|------------|
| Logo mark/wordmark | `public/brand/logo-mark.png` plus sm/md/lg retina PNGs with alpha, `components/brand/Logo.tsx` (transparent mark + Inter Tight wordmark) |
| Mark source files | `docs/brand/reference/logo-mark-source.jpg` (JPEG on black), `logo-lockup-source.jpg` (source only; not served on light UI) |
| Palette | `lib/design/tokens.css` + `lib/design/brand-spec.ts` |
| Typography | Inter Tight display + Inter + JetBrains Mono (`lib/design/fonts.ts`) |

## Canonical hexes

Primary `#C24400`, Accent Light `#CC4A00`, Ink `#0B0B0D`, White `#FFFFFF`, Stone `#F5F6F7`, Gray 200 `#E6E6E8`, Gray 400 `#A7A8B2`, Gray 600 `#61646B`, Gray 800 `#1D2024`, Success `#22C55E`, Warning `#FACC15`, Error `#FF4444`, Info `#3B82F6`.
