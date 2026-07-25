Reference images for the FixFlags brand (logo mockups, UI kit, mood boards).

These are **design references only** — not served at runtime. Production assets live in `public/brand/*.svg` and `lib/design/`.

- `logo-primary.png` — official primary lockup (mark + wordmark)
- `logo-primary-transparent.png` — transparent lockup reference (unused at runtime; SVG lockup is canonical)
- `ui-kit-v2.png` — UI Kit v2.0 (color palette, type scale, components)

Extracted into production:

- Logo mark/wordmark SVGs → `public/brand/*.svg` + `lib/design/logo-mark.tsx`
- Color palette (light + dark) → `lib/design/tokens.css` + `lib/design/brand-spec.ts`
- Typography → Inter + Inter Tight + JetBrains Mono (`lib/design/fonts.ts`)

Canonical hexes (Brand Sheet 2026-07): Primary `#FF5A00`, Accent Light `#FF7A33`, Ink `#0B0B0D`,
Stone `#F5F6F7`, Border `#E6E6E8`, Success `#22C55E`, Warning `#FACC15`, Error `#FF4444`, Info `#3B82F6`.
