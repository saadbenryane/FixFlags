# Session: Preview evidence overlay

**Date:** 2026-08-19
**Task:** `preview-evidence-overlay`
**Branch:** `main`

## Condition

Selecting a Flag highlights the measured element on the captured Product Preview and Report detail. If we did not measure that element at capture time, we do not draw a box. Page-scope Flags get an honest chip.

## Why

Live highlights used preset hero boxes and a second browser pass with generic CSS (`.demo-cta-primary`, `main`). Product Preview never received `BrowserFrame.viewportOverlay`. That is a guessed overlay, not scan evidence.

## Design

- Harvest bounding boxes on the capture page immediately after the viewport screenshot (and axe on desktop).
- Persist `Flag.evidenceTargets` as top-left 0–1 rects bound to a device.
- Join Flags to harvested nodes using the Flag’s own clues (axe target, H1, CTA, quoted evidence).
- One spotlight primitive on Preview and Report detail.
- Unmeasured / page-scope = chip. No presets.

## Out of scope

`game-on-product-loop`, `game-on-judgment-ledger`, `game-on-release-evidence`, credentialed release, CLI publish, unrelated dirty files.
