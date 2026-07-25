# Homepage hero glass: RGBA master + landscape sizing

- **Date:** 2026-07-25
- **Scope:** `public/marketing/visuals/home-hero-glass.webp`, `LandingHeroSection`, marketing art pipeline
- **Confidence:** high

## Evidence

Cursor chat “transparent” uploads repeatedly arrived as JPEG/RGB on black (~60KB). A file saved directly as `public/marketing/visuals/home image.png` was a true RGBA PNG (1536×1024, ~2.3MB, ~52% zero alpha). After despill of dark underside fringe only, runtime WebP stayed clean on the mesh canvas (`darkSemiTransparent` = 0).

The RGBA plate is landscape (~1.49). Width-boxing it into a narrow right column made the art short (~428px vs ~492px left column). Height-led CSS (`h-[32rem]` + aspect-ratio) made it large enough but **overflowed left into the copy** (negative gap). Width-filling a wider right column (`34–36rem` + `1fr` inside ~92rem) produced ~768×516 with ~32px gap and no overlap.

## Discovery

1. Chat image attachments are not a reliable RGBA transport.
2. True masters must be preserved; global unmate against black invents letter outlines (e.g. capital Y).
3. Landscape hero art must be sized to the right column width, not by unconstrained height.

## Why it matters

Black fringes and undersized glass make the hero feel broken next to mockups. Overlap into copy is worse than a slightly smaller plate.

## Correct approach

1. Save true RGBA under `docs/brand/reference/home-hero-glass-rgba-master.png`.
2. Despill only dark-on-partial / underside rim; lossless crop with ~24px transparent pad; ship `home-hero-glass.webp` (runtime dims tracked in `LandingHeroSection` — currently 1528×1024).
3. Layout: `Container variant="marketing"` (`--container-max-marketing` 92rem), `grid-cols-[minmax(0,34–36rem)_minmax(0,1fr)]`, `items-center`, glass `w-full` / `xl:max-w-[58rem]` in the right column, `object-right`.
4. Verify at 1440: gap ≥16px, no overlap, glass height ≈ left column (±15%).

## Prevention

Encoded in `.cursor/skills/fixflags-design-system/SKILL.md` (Homepage hero glass), `.cursor/rules/fixflags-ui.mdc` (Marketing visuals), and this learning.
