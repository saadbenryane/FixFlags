Reference images for the FixFlags brand (logo mockups, UI kit, mood boards).

- `logo-primary.png` — official primary lockup (mark + wordmark)
- `ui-kit-v2.png` — UI Kit v2.0 (color palette, type scale, components)

These were used to extract the production brand assets:
- Logo mark/wordmark SVGs → `public/brand/*.svg` + `lib/design/logo-mark.tsx`
- Transparent lockup → `public/brand/logo-primary-transparent.png`
- Color palette (light + dark) → `lib/design/tokens.css` + `lib/design/brand-spec.ts`
- Typography → Satoshi (`lib/design/fonts.ts`)

Canonical hexes (UI Kit v2.0): Primary `#FF4D1F`, Accent Light `#FF744D`, Ink `#0F1115`,
Secondary `#687380`, Border `#E5E7EB`, Success `#22C55E`, Warning `#FACC15`, Error `#FF4444`, Info `#3B82F6`.
