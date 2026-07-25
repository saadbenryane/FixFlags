# Marketing art: no black fringe on light pages

- **Date:** 2026-07-25
- **Scope:** Marketing hero / illustration assets (`public/marketing/visuals/*`)
- **Confidence:** high

## Evidence

Homepage hero plate arrives as JPEG/RGB on black. Soft-keying into alpha without unmatting leaves dark RGB on partial alpha — on light/mesh canvases that reads as a jagged black outline. Opaque bake onto `#FFFFFF` kills fringe on solid white, but marketing uses `GlobalMeshBackdrop`, so the white plate shows as a visible white rectangle.

Correct fix: flood-fill black bg → unpremultiply → edge despill (drop near-bg dark low-chroma AA; never leave dark RGB on partial alpha) → ship RGBA WebP. Metric `darkSemiTransparent` (lum&lt;50 and 8&lt;alpha&lt;240) must be 0. Live hero min lum stayed ≥110 with transparent padding.

## Discovery

Cursor often saves plates as JPEG/RGB on black even when the UI presents them as “transparent.” Soft-keying that black field into alpha **without** unmatting invents a dark halo. Opaque white bake only works when the page canvas is flat white; mesh/gradient pages need true alpha.

## Why it matters

Black outlines and white plates make brand art look broken. Users notice immediately.

## Correct approach

1. Prefer art already rendered on the destination canvas (white mockup crop) when available.
2. For black plates on mesh/light pages: flood-fill bg, unmate, despill edges, ship **RGBA** so the backdrop shows through. No dark RGB on partial alpha.
3. For solid white pages only: opaque bake onto `#FFFFFF` after the same unmate/despill is also fine.
4. Do not tight-trim into anti-aliased edges. Pad (~24–32px), then lossless crop only (no rescale/re-key). Verify pixel identity vs master extract.
5. If a true RGBA master exists, preserve its alpha; do not re-key or “improve” edges. Keep the full master under `docs/brand/reference/`.

## Prevention

Encoded in `.cursor/rules/fixflags-ui.mdc` (Mark / marketing visuals) and this learning.
