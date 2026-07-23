# Customer journey completion plan

*Evidence-backed after production dogfood on 2026-07-23. Supplements [launch-readiness-completion-plan.md](./launch-readiness-completion-plan.md).*

## Verdict

FixFlags’ **promise is clear** and the **scan loop is fast**. Brand/first impression is restored (`fix-live-images` on `main`). Remaining first-value gaps: anonymous Finish Plan evidence locked behind signup, and a Copy prompt control that can toast success while copying a gate string. Fix those in the access/persistence design. Do not paper over them with UI-only fallbacks.

| Dimension | Status | Why |
|-----------|--------|-----|
| Brand / first impression | **Solved** | `fix-live-images`: `/brand/**` + `/marketing/**` in `localPatterns`, Logo/`BrandIllustration` `unoptimized`, `npm run image:local-patterns-guard` |
| Anonymous wedge | Contract drift | PRODUCT + report-contract require visible evidence + exactly one real demonstrated prompt; live AI flags persist locked placeholders |
| Copy / gate honesty | Broken | `PromptCopyButton` copies whatever string it receives, including `TRIAGE_LOCKED_FIX` |
| Score vs status | Confusing | CRITICAL → BLOCKED while log-decay score can stay ~92 |
| Nav / CTA clarity | Partial | Competing “Try free” vs “Review my site”; `/new` 404; sample destinations split |
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

## Phase 1 — Anonymous wedge truth (do now, product)

**Goal:** Live anon report matches PRODUCT/report-contract without placeholder persistence.

### 1.1 Stop persisting gate strings as flag data

`lib/audit/persist.ts` `buildTriageAiFlagRow` currently writes:

- `TRIAGE_LOCKED_EVIDENCE`
- `TRIAGE_LOCKED_WHY`
- `TRIAGE_LOCKED_FIX`

into durable DB fields. Access control must be a read-time concern, not fake data.

| Change | Files |
|--------|-------|
| Triage schema/prompt produce real short evidence + why; no fix prompts | `judge-triage-schema.ts`, system triage prompt, `validate-triage-output.ts`, `judge-triage.ts` |
| Persist real evidence/why; `fix` and editor prompts null | `persist.ts` — delete `TRIAGE_LOCKED_*` |
| Prescription merge still fills prompts for owners | `mergePrescriptionResults` |
| Tests forbid locked strings in persisted rows | `persist-*.test.ts`, triage schema tests |

### 1.2 One real demonstrated prompt, not a placeholder

| Change | Files |
|--------|-------|
| `sampleFixFlag` / `promptAccess: 'one'` only when `resolveFixPrompt` is a real prompt | `fetch-audit.ts`, `report-view-model.ts`, `finish-plan.ts` |
| Marketing sample stays unlocked via explicit sample path | `samples/details`, `isPublicMarketingSample` |
| Anonymous details show evidence/why; lock **prompts only** | `ReportExplorer.tsx`, `FlagDetailPanel.tsx`, `LockedInspectionPane.tsx`, `copy.ts` |
| Align `LOCKED_INSPECTION` / `ANON_VALUE_STRIP` copy with evidence-visible contract | `lib/marketing/copy.ts` |

### 1.3 Honest Copy prompt

| Change | Files |
|--------|-------|
| Never pass gate placeholder into `PromptCopyButton` / `MarkdownPromptBox` / export | `FocusedAuditReport.tsx`, `SampleFixCard.tsx`, `ExportMenu.tsx` |
| Copy UI absent or disabled when `promptAccess !== 'all'/'one'` with a real prompt | `PromptCopyButton.tsx` |
| Toast + analytics only after a non-placeholder prompt is copied | same + tests |
| Regression: clipboard must not equal any `Sign up to get the fix prompt` string | unit + optional E2E |

### 1.4 Acceptance (anonymous dogfood)

On a fresh anon scan of a real URL (and `example.com` for regression):

1. Finish Plan shows three titles + real evidence (not “Create a free account to see evidence…”)
2. Exactly one Copy prompt copies a real editor-ready fix
3. Other two items show signup gate for prompts only
4. `/details` inspection pane shows evidence; fix area gated
5. After claim, remaining prompts unlock without refresh bugs (see `.agents/learnings/post-claim-report-unlock.md`)

---

## Phase 2 — Trust and clarity on the report (do now)

### 2.1 Score vs BLOCKED

`computeRubricStatus` marks CRITICAL → `BLOCKED` while `scoreFromFindings` log-decay can leave Message ~92. Customers read that as broken math.

**Proper design (pick one, encode in one place):**

- **Preferred:** When status is `BLOCKED`, clamp displayed rubric score to a blocked ceiling (below Pass threshold) **or** derive score after applying a hard CRITICAL floor so status and number cannot diverge.
- Surface a one-line help: status = launch gate; score = weighted finding volume — only if numbers remain after the clamp and still need explanation.

Touch: `lib/audit/checks/rubric.ts`, `lib/audit/rubric.ts`, `SCORE_HELP` in `copy.ts`, rubric UI, export summary tests.

### 2.2 Customer-facing flow URLs

Flow timeline showed `chrome-error://chromewebdata/` after external leave. Never show browser-internal error URLs in the report.

Touch: flow evidence / timeline presenters — map `chrome-error:*` and failed navigations to human copy (“Could not load destination” / “Left your domain”) while keeping raw URL in internal debug only.

### 2.3 Finish Plan ranking for AI-builder value

example.com produced 25 flags with heavy Reach/header/security volume. Ensure Finish Plan ranking continues to bias Product Contract / conversion / first-visit friction over CSP/HSTS-style Reach noise for the top three. Do not hide deterministic Reach checks; fix **ranking and presentation**, not the check registry.

Touch: `finish-plan.ts`, journey bias, accuracy/builder fixtures.

---

## Phase 3 — Navigation and conversion consistency (same day)

| Item | Proper fix |
|------|------------|
| `/new` | Add redirect/page → `/#audit` (intuitive start URL) |
| 404 “Start an audit” | Link `/#audit`, label with `HERO.primaryCta` |
| Sample details CTA `href="/"` | `/#audit` |
| Header “Sample report” | Canonical `/samples` (homepage keeps local `#sample-review`) |
| Header “Try free” | Prefer `Review my site` → `/#audit` for logged-out primary; reserve “Create free account” for post-value gates |

Touch: `app/new/page.tsx` or redirect, `not-found.tsx`, `AuditReport.tsx` sample CTA, `lib/site/nav.ts`, `MarketingHeaderAuth.tsx`, `copy.ts`, homepage/nav tests.

---

## Phase 4 — Design and module cleanliness (with the above, not instead)

Refactor for one contract, not cosmetic file splits:

1. Single `promptAccess` / `hasUsablePrompt(flag)` helper used by Finish Plan, focused report, details, export, MCP, CLI.
2. Remove dead dual status vocab if `statusFromScore` (EXCELLENT/GOOD/…) is unused at the UI boundary — one RubricStatus language: Pass / Needs Attention / Blocked.
3. Sample vs live access paths explicitly named; no accidental sample unlock on live anon.
4. Dead code adjudication only when behavior tests prove unused (handoff already warns against size-driven splits).

---

## Phase 5 — Prove it (gates, not vibes)

| Gate | Command / artifact |
|------|--------------------|
| Local full | `npm run verify` |
| Anon contract tests | finish-plan, report-access, report-view-model, persist, PromptCopy |
| Accuracy | `npm run accuracy:eval` |
| Release | `npm run verify:release` with designated credentials |
| Manual | QUALITY report contract smoke: anon + signed-in |
| Production dogfood | Paste URL → progressive → Finish Plan → one real copy → claim → re-check |
| Journey matrix | `.agents/sessions/credentialed-journey-matrix.md` |

Update matrix row “Anonymous wedge” from Partial → Pass only after Phase 1 acceptance.

---

## Phase 6 — Distribution (explicitly after Phase 1–5)

Do not scale ads / Product Hunt until:

- [x] Production brand restored (Phase 0 / `fix-live-images`)
- [ ] Anon wedge dogfood passes Phase 1 acceptance
- [ ] `verify:release` green
- [ ] Credentialed matrix signed for revenue paths
- [ ] Manual report smoke checked

---

## Ownership and sequencing

| Track | Owner note |
|-------|------------|
| Phase 0 brand | **Done** — `fix-live-images` |
| Phase 1–3 code | Claim BOARD scope that does not collide with `current-product-completion` write files; prefer sequential handoff if that task still owns `lib/audit/*` |
| Skills / session docs | This plan |

Preserve concurrent work. No reset/stash of other agents’ trees.

---

## Explicit non-goals (do not disguise as completion)

- Temporary “show problem text as evidence” UI fallbacks
- `unoptimized` logos to hide deploy lag
- Weakening accuracy or billing gates
- Claiming Touch complete without anon + signed-in smoke
- Inventing a second anon contract that contradicts PRODUCT.md
