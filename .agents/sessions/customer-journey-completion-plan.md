# Customer journey completion plan

*Evidence-backed after production dogfood on 2026-07-23. Supplements [launch-readiness-completion-plan.md](./launch-readiness-completion-plan.md).*

## Verdict

FixFlags’ **promise is clear** and the **scan loop is fast**. Brand/first impression is restored (`fix-live-images` on `main`). Remaining first-value gaps: anonymous Finish Plan evidence locked behind signup, and a Copy prompt control that can toast success while copying a gate string. Fix those in the access/persistence design. Do not paper over them with UI-only fallbacks.

| Dimension | Status | Why |
|-----------|--------|-----|
| Brand / first impression | **Solved** | `fix-live-images`: `/brand/**` + `/marketing/**` in `localPatterns`, Logo/`BrandIllustration` `unoptimized`, `npm run image:local-patterns-guard` |
| Anonymous wedge | **Implemented** | Triage persists real evidence/why; empty fix; usable-prompt gate; details show evidence |
| Copy / gate honesty | **Implemented** | `isUsableFixPrompt` + `PromptCopyButton` refuses placeholders |
| Score vs status | **Implemented** | CRITICAL caps rubric score at `BLOCKED_RUBRIC_SCORE_CEILING` (74) |
| Nav / CTA clarity | **Implemented** | `/new` → `/#audit`; header Review my site; Sample → `/samples` |
| Release proof | Blocked | Credentials still required for `verify:release` and journey matrix |

**Canonical anon contract** (do not invent a third version):

- Source of truth: `PRODUCT.md` + `knowledge/report-contract.md`
- One teaser scan
- All three Finish Plan items show real problem + evidence (+ why when available)
- Exactly **one** complete demonstrated fix prompt
- Remaining prompts gated until claim
- Public APIs never return gated prompts
- Marketing sample may show unlocked prompts; live anon must not silently degrade into locked placeholders

---

## Phase 0 — Brand recovery — **DONE** (2026-07-23)

Shipped via board `fix-live-images` on `main` (`1d25ac1` and follow-ups). Confirmed by product owner.

| Delivered | Where |
|-----------|--------|
| Allowlist `/brand/**` + `/marketing/**` | `next.config.ts` `images.localPatterns` |
| Logo + marketing public assets `unoptimized` | `Logo.tsx`, marketing visuals (avoid optimizer blanking) |
| CI guard | `scripts/image-local-patterns-guard.mjs` / `npm run image:local-patterns-guard` |
| Learning | `.agents/learnings/next-image-local-patterns-blank-assets.md` |

**Residual (not blocking Phase 1):** keep release smoke asserting brand URLs stay healthy after deploy.

---

## Phase 1 — Anonymous wedge truth — **DONE** (code 2026-07-23)

**Goal:** Live anon report matches PRODUCT/report-contract without placeholder persistence.

### Delivered

| Change | Where |
|--------|-------|
| Triage schema/prompt emit evidence + whyItMatters; no fix prompts | `judge-triage-schema.ts`, `system-prompt.ts` |
| Persist real evidence/why; `fix: ''`; delete `TRIAGE_LOCKED_*` | `persist.ts` |
| `isUsableFixPrompt` / `resolveFixPrompt` reject gate strings | `priority-flags.ts` |
| Demonstrated prompt only when usable | `report-access.ts` `findHighestSeverityFlagWithFix` |
| Details keep screenshots/evidence; lock prompts only | `ReportExplorer.tsx`, `LOCKED_INSPECTION` copy |
| Copy refuses placeholders | `PromptCopyButton.tsx` |

### 1.4 Acceptance (anonymous dogfood)

Still verify on production after deploy:

1. Finish Plan shows three titles + real evidence (not “Create a free account to see evidence…”)
2. Exactly one Copy prompt copies a real editor-ready fix when a usable prompt exists
3. Other items gate prompts only
4. `/details` inspection pane shows evidence; fix area gated
5. After claim, remaining prompts unlock without refresh bugs

---

## Phase 2 — Trust and clarity — **DONE** (code 2026-07-23)

### 2.1 Score vs BLOCKED

`BLOCKED_RUBRIC_SCORE_CEILING = 74` applied in `scoreFromFindings` when any CRITICAL flag exists. `SCORE_HELP` + help catalog updated.

### 2.2 Customer-facing flow URLs

`displayEvidenceUrl` maps `chrome-error:` / `chrome:` / `about:blank` → “Could not load destination” in Flow + Action timelines.

### 2.3 Finish Plan ranking

Reach hardening headers (`security-hsts-*`, `security-csp-*`, …) demoted in `compareFlagPrioritySignals` so conversion/flow Flags win top 3.

---

## Phase 3 — Navigation and conversion — **DONE** (code 2026-07-23)

| Item | Fix |
|------|-----|
| `/new` | `app/new/page.tsx` → `redirect('/#audit')` |
| 404 CTA | `/#audit` + `HERO.primaryCta` |
| Sample details CTA | `/#audit` |
| Header Sample report | `/samples` |
| Header primary | `Review my site` → `/#audit` |

---

## Phase 4 — Design and module cleanliness (with the above, not instead)

Shipped with Phases 1–3:

1. Shared `isUsableFixPrompt` / `resolveFixPrompt` across Finish Plan + Copy + sample selection.
2. Score/status alignment at scoring source.
3. Sample unlock remains on sample path; live anon uses usable-prompt gate.

Remaining optional: dual status vocab cleanup (`statusFromScore` EXCELLENT/GOOD vs Pass/Needs Attention/Blocked) — not blocking first-value.

---

## Phase 5 — Prove it (gates, not vibes)

| Gate | Command / artifact |
|------|--------------------|
| Local changed-file | `npm run agent -- verify` |
| Anon contract tests | finish-plan, report-access, persist, priority-flags, PromptCopy |
| Accuracy | `npm run accuracy:eval` |
| Release | `npm run verify:release` with designated credentials |
| Manual | QUALITY report contract smoke: anon + signed-in |
| Production dogfood | Paste URL → progressive → Finish Plan → one real copy → claim → re-check |
| Journey matrix | `.agents/sessions/credentialed-journey-matrix.md` |

Update matrix row “Anonymous wedge” from Fail → Pass only after production dogfood of Phase 1 acceptance.

---

## Phase 6 — Distribution (explicitly after Phase 5)

Do not scale ads / Product Hunt until:

- [x] Production brand restored (Phase 0 / `fix-live-images`)
- [x] Phase 1–3 code landed (await production dogfood)
- [ ] Anon wedge dogfood passes Phase 1 acceptance on live
- [ ] `verify:release` green
- [ ] Credentialed matrix signed for revenue paths
- [ ] Manual report smoke checked

---

## Ownership and sequencing

| Track | Owner note |
|-------|------------|
| Phase 0 brand | **Done** — `fix-live-images` |
| Phase 1–3 code | **Done** on `cursor/customer-journey-completion-5413` |
| Skills / session docs | This plan |
| Production dogfood + matrix | After merge/deploy |

Preserve concurrent work. No reset/stash of other agents’ trees.

---

## Explicit non-goals (do not disguise as completion)

- Temporary “show problem text as evidence” UI fallbacks
- `unoptimized` logos to hide deploy lag
- Weakening accuracy or billing gates
- Claiming Touch complete without anon + signed-in smoke
- Inventing a second anon contract that contradicts PRODUCT.md