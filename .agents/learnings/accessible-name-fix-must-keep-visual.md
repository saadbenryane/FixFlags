# Accessible-name fixes must keep the visual

**Date:** 2026-08-31
**Check module:** `lib/audit/checks/accessibility.ts`
**Confidence:** HIGH
**Evidence:** Shopify and Linear HTML fixtures fire `buttons-no-text` on icon chrome; previous fallback fix started with "Add visible text to icon-only buttons"

## False positive pattern

The Flag can be true (a close or menu button has no accessible name) and the prescription still be harmful. "Add visible text" in an editor prompt turns icon chrome into labeled buttons and wrecks the layout.

## Root cause

HTML-only and axe `button-name` / `link-name` fixes treated visible text as the default repair. That is valid for empty text buttons. It is the wrong default for icon-only chrome.

## Fix

Prescriptions now lead with: keep the current visual, add `aria-label` or a visually hidden label, then confirm in the accessibility tree. Do not add visible text that changes the layout.

## Regression prevention

- `lib/audit/__tests__/checks.test.ts` asserts HTML fallback and axe-backed fixes keep the visual
- `lib/audit/__tests__/metadata.test.ts` asserts aria-label icon buttons are not counted as unnamed
- `.agents/accuracy/false-positives.json` `fp-014`

## Related corpus entries

- `shopify-com.html` still records `buttons-no-text` as POLISH HTML fallback
- `linear-app.html` HTML-only name Flags stay POLISH
