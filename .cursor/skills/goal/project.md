# FixFlags goal overlays

Read when running `/goal` in this repo.

## Canonical regression loop

1. **Baseline:** `https://fixflags.com/demo` → `lib/demo/fixtures/original.ts` (do not edit)
2. **Fixed fork:** `https://fixflags.com/demo/v1` → `lib/demo/fixtures/v1.ts`
3. **Measure:** `tsx scripts/demo-fixture-audit.ts [baseUrl]`
4. **Prompt quality:** `lib/audit/flag-copy.ts` (`buildExpertFixPrompt`, `whyItMattersForCheckId`)
5. **Apply fixes:** edit v1 fixture / checks as a developer would from expert prompts
6. **Verify:** re-run script + `npm run test:unit`

Success: applying every FixFlags prompt on a fork should drive flags → 0 (minus documented site-level exceptions: sitemap, robots.txt at domain root, cookie consent if analytics loads).

## Common done checks

| Check | Command |
|-------|---------|
| Unit tests | `npm run test:unit` |
| Demo regression | `tsx scripts/demo-fixture-audit.ts http://localhost:3000` (needs `npm run dev`) |
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
