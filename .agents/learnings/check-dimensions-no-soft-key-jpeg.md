# Check-dimensions art: no soft-key from mockup JPEGs

- **Date:** 2026-07-26
- **Scope:** `CheckDimensionsSection`, `CheckDimensionsScene`, `public/marketing/visuals/check-dimensions-*`
- **Confidence:** high

## Evidence

Chat mockup for “Every dimension of release readiness” arrived as JPEG/RGB on near-white (`#FCFAFB`). Soft-keying that plate into alpha left white RGB on partial alpha — the same white-fringe failure mode as the early hero glass attempts. Flood-fill from edges still left `whitePartial` halo on orange QA composites. Pedestal icons in the 1024px plate were too small/washed to clip cleanly.

## Discovery

1. Opaque mockup crops avoid fringe on matching flat white, but show a white rectangle on `GlobalMeshBackdrop`.
2. True RGBA masters (or CSS-drawn scenes) are required for mesh marketing pages.
3. Flip `CHECK_DIMENSIONS_CENTER.useImageAsset` only after a true RGBA WebP lands with `darkSemiTransparent = 0` and no white plate.

## Correct approach

1. Ship CSS scene + CSS pedestals until hi-res transparent masters arrive.
2. Drop masters at `docs/brand/reference/` and runtime `public/marketing/visuals/check-dimensions-center.webp` (+ optional `value-*.webp`).
3. Preserve alpha; despill dark underside/rim only; pad ~20px; never re-key white interiors.

## Prevention

Encoded in `CheckDimensionsScene.tsx` (`useImageAsset` gate) and this learning.
