# FixFlags goal overlays

Read when running `/goal` in this repo.

## Canonical regression loop (local-first)

1. **Baseline:** `/demo` → `lib/demo/fixtures/original.ts` (do not edit)
2. **Fixed fork:** `/demo/v1` → `lib/demo/fixtures/v1.ts`
3. **Measure locally:**
   - **Live:** `npm run demo:audit` (needs `npm run dev`) — fetches rendered Next.js HTML
   - **Offline:** `npm run demo:audit:offline` — static HTML from fixtures (fastest)
4. **Apply fixes:** edit v1 fixture + `DemoLanding` as a developer would from expert prompts
5. **Prompt quality:** `lib/audit/flag-copy.ts`
6. **Verify:** `npm run test:unit` (includes offline + live-if-dev-server tests)

**Done when (local):** in-scope v1 flags = 0, original ≥ 8 flags.

**Production smoke (optional):** `npm run demo:audit:production` — full unscoped audit post-deploy.

In-scope excludes site/env noise: `no-https` (localhost), sitemap/robots.txt at domain root, PageSpeed/mobile capture checks. See `lib/demo/demo-audit-scope.ts`.

## Common done checks

| Check | Command |
|-------|---------|
| Unit tests | `npm run test:unit` |
| Demo regression (live) | `npm run demo:audit` |
| Demo regression (offline) | `npm run demo:audit:offline` |
| Production smoke | `npm run demo:audit:production` |
| Real pipeline | `npm run dev:all` + audit URL (worker required) |
| Marketing guards | `lib/__tests__/homepage-message.test.ts` |
| Flag copy | `lib/audit/__tests__/flag-copy.test.ts` |

## Dev notes

- `npm run dev` alone leaves audits QUEUED — use `npm run dev:all` for real audits
- Refresh marketing sample: `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/refresh-marketing-sample.ts`
- AGENTS.md: landing section order, banned phrases, changelog rules

## Expert prompt bar

Each flag prompt must include:
- **Why** — outcome (clicks, trust, indexing), never "affects reach quality"
- **Found** — factual evidence from checks
- **Do** — concrete change (metadata export, CSS, copy)
- **Verify** — from `verificationRuleForCheckId` or enrichment

No "look at [whole page] on the screenshot" for `<head>` / metadata / JSON-LD issues.

## Related skills

- `fixflags-product` — entitlements, pipeline, dev workflow
- `fixflags-marketing` — copy, ICP, positioning
- `babysit` — PR merge loop (narrower scope)
