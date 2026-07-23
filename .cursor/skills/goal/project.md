# FixFlags goal overlays

Read when running `/goal` in this repo.

## Audit capability map

**Source of truth:** `lib/audit/capability-matrix.ts`  
**Report:** `npm run audit:capabilities`

Organizes what we test by dimension (MESSAGE / EXPERIENCE / REACH), category (copy, flow, loading, design-language, etc.), and tool:

| Tool | What it does |
|------|----------------|
| `html-parse` | Cheerio metadata + deterministic checks (fast) |
| `browser-capture` | Playwright screenshots + DOM metrics |
| `flow-navigation` | CTA click + navigation trace |
| `pagespeed` | Google PageSpeed / Lighthouse API |
| `ai-judge` | Vision LLM rubric pass |
| `internal-guard` | FixFlags repo CI guards only |

Status per capability: `live` | `partial` | `planned`.

## Local iteration loop (default)

| Layer | Command | Tests |
|-------|---------|-------|
| Offline accuracy gate | `npm run accuracy:eval` | Gold 0 false blockers, builder top-3, demo repair |
| Live HTML adjudication | `npm run accuracy:probe -- <url>` | Before changing checks on real sites |
| Copy / metadata / SEO | `npm run demo:audit:offline` | Fastest, no dev server |
| Rendered HTML | `npm run demo:audit` | Needs `npm run dev` |
| CTA flow | `npm run demo:audit:flow` | Playwright click path |
| Unit regression | `npm run test:unit` | All checks + fixtures |
| Capability map | `npm run audit:capabilities` | 0 unmapped checkIds |

**Fixtures:** `original.ts` (baseline flaws) → `v1.ts` (fixed fork). Apply expert prompts from `lib/audit/flag-copy.ts`.

**Done when (local):** v1 in-scope flags = 0 on audit + flow; original ≥ 8 flags; tests pass.

**Production smoke (optional):** `npm run demo:audit:production`

In-scope excludes site/env noise. See `lib/demo/demo-audit-scope.ts`.

## Planned next (see matrix)

- Multi-step flow (pricing nav, mobile menu, form submit)
- Design token consistency (DOM style sampling)
- Social proof slop detection
- Form validation feedback flow

## Expert prompt bar

Each flag prompt: Problem / Why / Found / Do / Verify. No screenshot fluff for `<head>` issues.

## Related skills

- `fixflags-scan-accuracy` — corpus, probes, false-positive fixes, accuracy gate
- `fixflags-product` — entitlements, pipeline, dev workflow
- `fixflags-marketing` — copy, ICP, positioning
