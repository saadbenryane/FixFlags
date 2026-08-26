# Site-Wide SEO Parity — Game On

## Condition

Every existing indexable route has full metadata parity, schema.org coverage on key surfaces, explicit public report indexation, and CI guards that prevent regressions.

## Proof

```bash
npm run seo:guard
npm run metadata:route-guard
npx vitest run lib/marketing/__tests__/metadata.test.ts lib/marketing/__tests__/structured-data.test.ts
npm run validate:quick
```

Manual (operator): Rich Results matrix in `docs/seo-deploy-checklist.md`.

## Tracks

| Track | Status | Proof |
|-------|--------|-------|
| P1 metadata parity | MET | buildPageMetadata on partners/tools; buildHelp/Docs/Blog/Issue helpers; report robots |
| P2 schema.org | MET | help hub, issues index, blog, tools, public report JSON-LD |
| P3 technical SEO | MET | main landmarks, blog h1, metadataBase in root layout |
| P4 CI guards | MET | metadata-route-guard + extended seo-guard in validate.mjs |
| P5 docs | PARTIAL | docs/seo.md + checklist updated; Rich Results not run in browser |

## Turn log

| Turn | Work | Verdict |
|------|------|---------|
| 1 | Metadata helpers + page updates | MET |
| 2 | Structured data + page wiring | MET |
| 3 | Guards + tests + docs | MET |
| 4 | Automated verification | MET |
| 5 | Manual Rich Results | PARTIAL — deferred to deploy |
