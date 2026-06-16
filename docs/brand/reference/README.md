Reference images for the FixFlags brand (logo mockups, UI kit, mood boards).

These are **design references only** — not served at runtime. Production assets live in `public/brand/*.svg` and `lib/design/`.

- `logo-primary.png` — official primary lockup (mark + wordmark)
- `logo-primary-transparent.png` — transparent lockup reference (unused at runtime; SVG lockup is canonical)
- `ui-kit-v2.png` — UI Kit v2.0 (color palette, type scale, components)

Extracted into production:

- Logo mark/wordmark SVGs → `public/brand/*.svg` + `lib/design/logo-mark.tsx`
- Color palette (light + dark) → `lib/design/tokens.css` + `lib/design/brand-spec.ts`
- Typography → Satoshi (`lib/design/fonts.ts`)

Canonical hexes (UI Kit v2.0): Primary `#FF4D1F`, Accent Light `#FF744D`, Ink `#0F1115`,
Secondary `#687380`, Border `#E5E7EB`, Success `#22C55E`, Warning `#FACC15`, Error `#FF4444`, Info `#3B82F6`.
