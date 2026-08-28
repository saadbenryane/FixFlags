# Consent chrome is not an overlay blocker

**Date:** 2026-08-28  
**Scope:** `overlay-blocks-form` / `overlay-blocks-cta` / `overlay-blocks-nav` vs `cookie-consent-absent`  
**Confidence:** high  
**Evidence:** saadbenryane.com / sbhome `CookieConsentBanner` (`role=dialog`, `fixed inset-x-0 bottom-0`, Accept + Reject); journey path previously emitted CRITICAL without severity gates.

## Findings

1. Requiring cookie consent when analytics load (`cookie-consent-absent`) while also flagging the same banner as a conversion overlay is a product contradiction.
2. Dismissible consent chrome (cookie/consent cues plus Accept and Reject) is expected compliance UI, not a sticky ad.
3. Journey signup must emit through `runOverlayBlockerChecks` so coverage suppress/partial and consent suppress apply; hardcoded CRITICAL skipped those gates.
4. Interaction probes should dismiss consent (prefer Reject) before form/CTA hit-tests so post-consent product UX is what we judge.

## Prevention

- `looksLikeConsentChrome` on `OverlayBlockerInfo` + `isDismissibleConsentChrome` / suppress in `runOverlayBlockerChecks`
- `dismissConsentChrome` before form probes, flow CTA, and journey overlay detection
- Regression fixtures in `non-html-regression.json` and false-positive hardening tests
