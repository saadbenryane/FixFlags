# Replit Tier B adjudication

**Date:** 2026-07-23  
**Probe tool:** `npm run accuracy:probe` (HTML fetch, no browser)  
**Note:** `replit.com` returns HTTP 403 — use deployed `*.replit.app` URLs only.

## Summary

| URL | IMPORTANT | POLISH | Top-3 actionable? | Fixture |
|-----|-----------|--------|-------------------|---------|
| cineverse.replit.app | 1 | 5 | Yes — H1 + security | **Frozen** |
| architects-eye.replit.app | 3 | 9 | Yes — meta/H1/og gaps | Live probe only |
| ai-landing-page-1.replit.app | 2 | 7 | Yes — H1 + og:image | Live probe only |
| meetweli-landing.replit.app | 3 | 9 | Yes — description/H1/og | Live probe only |

## Per-URL detail

### cineverse.replit.app (primary corpus)

- **IMPORTANT:** `h1-missing` — confirmed in raw HTML (0 `<h1>` tags; SPA shell). Legitimate for Replit-deployed React apps.
- **POLISH:** measurement, no-privacy-policy, security headers (csp, frame-options, content-type-options)
- **Adjudication:** ACCEPT as Tier B builder. Cap at 2 IMPORTANT in corpus.

### architects-eye.replit.app

- **IMPORTANT:** `description-missing`, `h1-missing`, `og-image-missing`
- **POLISH:** canonical, measurement, privacy, structured data, og meta, security cluster
- **Adjudication:** ACCEPT — classic “shipped fast” SEO gaps.

### ai-landing-page-1.replit.app

- **IMPORTANT:** `h1-missing`, `og-image-missing`
- **Adjudication:** ACCEPT — AI landing template archetype.

### meetweli-landing.replit.app

- **IMPORTANT:** `description-missing`, `h1-missing`, `og-image-missing`
- **Adjudication:** ACCEPT — polished B2B landing with meta gaps.

## Gold standard comparison (same probe run)

| URL | IMPORTANT | Notes |
|-----|-----------|-------|
| stripe.com | 0 | POLISH only (friction, measurement, skip-link) |
| vercel.com | 0 | POLISH only |
| nextjs.org | 0 | POLISH only (messaging-no-audience is debatable) |

**Conclusion:** Good sites do not get false IMPORTANT blockers. “Bad score” perception on gold sites is POLISH volume, not blocker FPs. Replit apps correctly surface meta/H1 gaps as IMPORTANT.

## Deferred

- Full-browser dogfood on cineverse to confirm H1 is not client-rendered after hydration
- `replit.com` homepage — blocked by bot protection
