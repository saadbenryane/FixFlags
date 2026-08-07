# FixFlags Lab — Complete Plan

**Status:** Replaces `fixflags-lovable-lab.md` — Lovable removed. Agent builds, you deploy, Git checkpoints, FixFlags judges.

---

## What This Is

A **permanent internal dogfood harness** that uses FixFlags to improve FixFlags.

- **Lab app:** Real code in `~/Code/fixflags-lab-01/` (Next.js + shadcn/ui + fake local business)
- **Generator:** Me (agent) — writes/edits files, spawns subagents for features
- **Deploy:** Your existing pipeline (Vercel/Netlify/CF Pages/whatever)
- **Checkpoints:** Git tags (`bench-v0`, `bench-v1`, …) — standard, no Lovable sync
- **Judge:** FixFlags (local dev or worker) against the live URL
- **Learnings:** → `.agents/learnings/`, accuracy fixtures, check/judge/prompt fixes

**No MCP auth, no Lovable credits, no external allowlists.** Pure code.

---

## Reused FixFlags Infrastructure (don't rebuild)

| Area | Existing | How Lab Uses It |
|------|----------|-----------------|
| **Audit pipeline** | `lib/audit/runner.ts`, `lib/audit/pipeline/` | Run full product review on lab URL |
| **Checks** | `lib/audit/checks/`, `check-ids.ts` | Deterministic + AI flags on lab HTML |
| **Judge** | `lib/audit/judge*.ts`, `judge-config.ts` | LLM adjudication of findings |
| **Finish Plan** | `lib/audit/finish-plan.ts`, `finish-plan.ts` | Ranked flags + fix prompts |
| **Accuracy fixtures** | `lib/audit/accuracy-corpus.ts`, `accuracy-browser-corpus.ts` | Add lab pages as regression fixtures |
| **Dogfood skill** | `.agents/skills/fixflags-dogfood-accuracy/` | Adjudication protocol (true/fp/dupe) |
| **Scan accuracy skill** | `.agents/skills/fixflags-scan-accuracy/` | Offline + live eval gates |
| **MCP (FixFlags)** | `lib/mcp/tools.ts`, `tool-manifest.ts` | Run reviews via `checkAndPlan`, `getReport` |
| **Browser capture** | `lib/audit/screenshot.ts`, `lib/audit/capture/` | Already validated; lab uses same |
| **Learnings** | `.agents/learnings/` | Durable facts from each lab run |
| **Report contract** | `knowledge/report-contract.md` | Output shape is canonical |

---

## Lab App Spec (one-time scaffold, then evolve)

**Fake business:** "Cornerstone Coffee Roasters" — local roaster + café + subscription  
**Pages needed (in order):**

1. `/` — Landing: hero, value props, featured coffee, CTA to subscribe
2. `/shop` — Product grid (bags, subscriptions, merch) — add to cart (mock)
3. `/subscribe` — Subscription builder (frequency, grind, quantity) — form + Stripe mock
4. `/about` — Story, team, sustainability, contact
5. `/blog/[slug]` — 2–3 articles (brew guides, origin stories)

**Tech stack (matches FixFlags dogfood targets):**
- Next.js 14+ (App Router), React 18, TypeScript
- Tailwind + shadcn/ui components
- **No real backend** — mock data, client-side cart, forms post to nowhere
- **Intentional flaws** for FixFlags to catch (we add/remove per mission)

**Repo:** `~/Code/fixflags-lab-01/` (sibling, not nested)

---

## Operating Loop (every mission)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CHECKPOINT (optional)                                        │
│    git checkout bench-vN  →  you deploy  →  live URL            │
├─────────────────────────────────────────────────────────────────┤
│ 2. REVIEW                                                       │
│    FixFlags product review on URL → report ID                   │
├─────────────────────────────────────────────────────────────────┤
│ 3. ADJUDICATE (dogfood protocol)                                │
│    For each top flag: true / false-positive / duplicate / weak  │
│    → Log in run log + .agents/learnings/ if FixFlags fix needed │
├─────────────────────────────────────────────────────────────────┤
│ 4. FIX                                                          │
│    FP/bogus  →  root-cause in FixFlags  →  patch  →  retest     │
│    True bug  →  I edit lab code  →  you deploy  →  update review│
├─────────────────────────────────────────────────────────────────┤
│ 5. CHECKPOINT                                                    │
│    git tag bench-v{N+1}  (baseline for next regression test)    │
└─────────────────────────────────────────────────────────────────┘
```

**Mission types (rotate):**
- **FP Hunt** — run review, kill false positives, add fixtures
- **Prompt Quality** — apply FixFlags fix prompt to lab code, verify it works
- **Regression** — restore `bench-v0`, run current FixFlags, compare to saved baseline
- **New Check** — add a deterministic check, verify on lab, add fixture
- **Judge Tuning** — adjust prompts/temperature, re-adjudicate same flags

---

## What You Do (once + per deploy)

| Once | Per Deploy |
|------|------------|
| Create `~/Code/fixflags-lab-01/` (or let me init) | `git pull && deploy` (your pipeline) |
| Confirm deploy URL pattern (e.g., `fixflags-lab.vercel.app`) | Tell me the live URL |
| FixFlags local env works (`npm run dev` + review) | — |
| Approve: I write to lab repo, you deploy | — |

---

## What I Do (autonomous after scaffold)

1. **Scaffold lab app** (Next.js + pages + intentional flaws)
2. **Run FixFlags** via MCP/CLI/local API
3. **Adjudicate** using dogfood protocol
4. **Fix FixFlags** (checks, judge, prompts, fixtures) → commit to `qewos`
5. **Edit lab code** for true issues → you deploy
6. **Tag checkpoints** → `git tag bench-vN`
7. **Log** → this file + `.agents/learnings/`
8. **Repeat** next mission

---

## Implementation Phases

### P0 — Scaffold (this session)
- [x] Init `~/Code/fixflags-lab-01/` with Next.js + shadcn/ui + 5 pages
- [x] Add **known flaws** for v0 baseline (see Flaw Catalog below)
- [ ] You deploy → give me URL
- [x] Tag `bench-v0`
- [ ] First FixFlags review + adjudication saved to run log

### P1 — FP Hunt + Fixtures (next 1–2 sessions)
- [ ] Run review on `bench-v0`
- [ ] Adjudicate all top flags
- [ ] Every FP → root-cause → FixFlags patch → retest same URL until clean
- [ ] Add lab HTML to `accuracy-corpus.ts` + `accuracy-browser-corpus.ts`
- [ ] Tag `bench-v1` (cleaner baseline)

### P2 — Prompt Quality (next session)
- [ ] Take top true flag from `bench-v1`
- [ ] Apply FixFlags fix prompt to lab code
- [ ] You deploy → FixFlags update review
- [ ] Verify prompt was actionable, fix stuck
- [ ] Log prompt quality notes

### P3 — Regression Drill (ongoing)
- [ ] `git checkout bench-v0` → deploy → run current FixFlags
- [ ] Compare to saved `bench-v0` baseline
- [ ] Detect regressions/improvements
- [ ] Back to `main` / `bench-latest`

### P4 — Automation (only if repeating weekly)
- [ ] Thin script: `npm run lab:review` (runs review, appends log)
- [ ] CI job: nightly regression on `bench-v0`

---

## Flaw Catalog (v0 intentional issues)

| Page | Flaw | Category | FixFlags Check Target |
|------|------|----------|----------------------|
| `/` | Hero H1 missing (uses `div`) | Message/SEO | `heading-hierarchy` |
| `/` | CTA button `<a>` not `<button>` | Experience/Accessibility | `cta-semantics` |
| `/` | No `meta description` | Message/SEO | `meta-description` |
| `/shop` | Product images missing `alt` | Experience/Accessibility | `image-alt` |
| `/shop` | Price not in `<data>` / microdata | Reach/SEO | `structured-data` |
| `/subscribe` | Form labels not linked to inputs | Experience/Accessibility | `form-labels` |
| `/subscribe` | No `autocomplete` on email | Experience/Accessibility | `autocomplete-attrs` |
| `/about` | Thin content (<200 words) | Message/Content | `content-depth` |
| `/blog/*` | No `article` schema | Reach/SEO | `structured-data` |
| Global | No `sitemap.xml` / `robots.txt` | Reach/Technical | `sitemap-exists` |
| Global | Cookie banner blocks content (mock) | Experience/UX | `cookie-banner-ux` |
| Global | LCP image not preloaded | Experience/Perf | `lcp-preload` |

**We add/remove flaws per mission.** Never all at once.

---

## Run Log

| Date | Checkpoint | FixFlags Report | Flags (T/FP/D/W) | FixFlags Changes | Lab Changes | Notes |
|------|------------|-----------------|------------------|------------------|-------------|-------|
| 2026-03-08 | bench-v0 | — | — | — | scaffold + 12 intentional flaws | Ready for first review. Deploy and run FixFlags. |

---

## Repo Hygiene

- **`qewos/`** — FixFlags only. Lab never nested.
- **`fixflags-lab-01/`** — Lab only. Normal Git history.
- **Learnings** → `.agents/learnings/fixflags-lab-*.md`
- **Fixtures** → `lib/audit/accuracy-corpus.ts` (offline) + `accuracy-browser-corpus.ts` (live)
- **Skills** → dogfood/scan-accuracy skills already encode protocol

---

## Definition of Done (per mission)

- [ ] FixFlags review completes without crash
- [ ] Every top-5 flag adjudicated (T/FP/D/W)
- [ ] Every FP has root-cause + FixFlags fix + retest passes
- [ ] True fixes applied to lab OR logged as "lab not fixed" with reason
- [ ] Checkpoint tagged
- [ ] Run log row added
- [ ] Any FixFlags code changes committed to `qewos` with tests

---

## Start Now (P0)

**You:** Confirm `~/Code/fixflags-lab-01/` exists or let me create it.  
**Me:** Scaffold Next.js + 5 pages + flaws → you deploy → URL → `bench-v0` → first review.

**Game on.**