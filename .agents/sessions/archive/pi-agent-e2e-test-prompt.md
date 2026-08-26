# PI Agent E2E Test Prompt: FixFlags Real-User Journey Validation

**Purpose**: Execute a comprehensive, evidence-backed test of FixFlags as a real AI-builder user would experience it — from anonymous URL submission through Fix list, demonstrated fix, claim, update review, and re-check diff. This prompt optimizes for **scan quality signal**, **first-value trust**, and **experience polish**.

---

## Agent Persona & Context

You are a **Product Intelligence auditor** simulating a **solo AI-first founder** who just built a product with Lovable/Cursor/Claude Code and is about to launch on Product Hunt. You're skeptical, time-pressed, and need to know: *"What did I miss that will embarrass me publicly?"*

**Your mental model**: "It works for me. What did I miss?"
**Your goal**: Get a Finish Plan I can trust, apply exactly one fix, verify it landed, and decide if FixFlags is worth paying for.

---

## Test Targets (Run All Three)

| Target | Why | URL Source |
|--------|-----|------------|
| **Your own live product** (if deployed) | Dogfood truth; you know the real bugs | Your deployed URL |
| **A known-good AI-built reference** | Calibrate false positive rate | `https://linear.app` or `https://vercel.com` |
| **A known-problematic test case** | Validate detection recall | Use `npm run accuracy:capture-fixtures` to pick a fixture URL, or deploy a deliberately broken page |

> **Run each target as a separate session.** Do not mix evidence across runs.

---

## Phase 0: Pre-Flight Checks (2 min)

```bash
# Verify local environment is production-like
npm run accuracy:eval          # Must pass: 0 failures
npm run agent -- context ui    # Confirm report contract context
```

**Record**: `accuracy:eval` result (pass/fail + fixture count).

---

## Phase 1: Anonymous First Scan — The Trust Moment (10 min)

### 1.1 Homepage → Submission
- Navigate to `/` (homepage)
- **Observe**: Hero copy matches `CUSTOMER_TERMS.tagline` ("Finish what your AI started")
- **Observe**: Primary CTA says "Review my product" (not "Start scan", "Audit", "Check")
- Paste your test URL into the input
- **Observe**: Input stays disabled until hydration completes (no pre-hydration navigation)
- Submit

### 1.2 Progressive Report — Live Capture
**Expect**: Immediate report geometry (not a spinner page). URL history-replaces to `/report/{id}`.

**Record for each stage** (screenshot + notes):
| Stage | Expected | Actual | Evidence Quality |
|-------|----------|--------|------------------|
| QUEUED | "Queued" badge, progress 0% | | |
| CAPTURING | "Capturing desktop & mobile" + live screenshot placeholders | | |
| CHECKING | "Running deterministic checks" + partial Flags streaming in | | |
| JUDGING | "AI review in progress" (if deep review) | | |
| FINALIZING | "Finalizing your Finish Plan" | | |
| COMPLETED | Full report mounts, progressive frame holds until swap | | |

**Critical checks**:
- [ ] Desktop + mobile capture placeholders resolve **independently** (not simultaneously)
- [ ] Partial Flags appear in **ranked order** (highest impact first) as they stream
- [ ] "How FixFlags is checking" stays **collapsed** until COMPLETED
- [ ] No fake rotating copy ("Checking headlines...", "Analyzing buttons...")
- [ ] Progress advances with **real pipeline stages**, not simulated percentages

### 1.3 Finish Plan — Anonymous Contract (THE MOST IMPORTANT MOMENT)

**Per PRODUCT.md & report-contract.md, the anonymous report MUST show:**

| Requirement | Pass? | Evidence |
|-------------|-------|----------|
| **3 Finish Plan items** (Message, Experience, Reach) with titles | | |
| **Real evidence** for each (not "Create account to see evidence...") | | |
| **Exactly ONE** complete demonstrated fix prompt (editor-ready, clipboard works) | | |
| **Remaining prompts gated** (show lock + "Create free account to copy") | | |
| **Copy button on demonstrated prompt**: copies real fix text, toasts "Copied to clipboard" | | |
| **Copy button on gated prompts**: refuses, toasts "Create account to copy this fix" | | |
| **No gate strings persisted** as evidence or fix text in Flag rows | | |

**Deep inspection of the demonstrated prompt**:
- [ ] Prompt references **specific file/path** (e.g., `app/components/Hero.tsx:42`)
- [ ] Prompt includes **exact code change** (before/after snippet)
- [ ] Prompt explains **why** (evidence-linked: "Mobile CTA at 394px, below 375px fold")
- [ ] Prompt is **editor-ready** — paste into Cursor/Claude Code → applies cleanly

**Screenshot**: The full Finish Plan with all 3 items expanded, showing evidence + demonstrated prompt.

---

## Phase 2: Report Workspace — Deep Dive (15 min)

### 2.1 Canonical Report Structure (`/report/[id]`)
Verify **exact hierarchy** per `report-contract.md`:

1. **Compact identity row** → hostname, URL, status, actions
2. **Re-check result** (N/A on first scan)
3. **Progress band** (`#report-status`) → release score, unresolved count, M/E/Reach coverage
4. **Sticky section nav** (appears when ≥2 sections)
5. **Top fixes** (`#report-top-fixes`) → full ranked bundle
6. **Complete ranked fix list** (`#report-flags`) → screenshot evidence + selected detail
7. **Made with** (`#report-stack`) → sanitized tech detection
8. **Product Contract** (`#report-contract`) → editable, persists
9. **Verified Memory** (`#report-remember`) → shows if project has learnings
10. **Funnel/Flow/Timeline** (`#report-funnel`) → clickable steps
11. **Share/Previews/Launch/Watch** controls
12. **Owner re-check** (`#report-recheck`)
13. **At most ONE** contextual signup/upgrade moment

### 2.2 Fix List Interaction (Core Value)
- [ ] **All unresolved Flags render** (no truncation, no "show more")
- [ ] **Ranking makes sense**: Conversion/flow blockers > security headers > polish
- [ ] **Filter chips work**: Rubric (Message/Experience/Reach), Severity (Blocker/High/Medium/Polish), Impact, Page
- [ ] **Per-Flag detail**:
  - Meta row: Severity → Rubric → Impact (only Critical gets `CircleAlert` icon)
  - **Why it matters** (evidence-linked, not generic)
  - **How to fix** (editor-ready prompt when unlocked)
  - **Screenshot comparison**: Desktop (red=affected) / Mobile (green=unaffected) / Neutral=missing
  - **Viewport toggle** works on mobile (375px) — standalone capture pair on desktop

### 2.3 Funnel & Path Replay
- [ ] **Funnel** shows: Entry → Value Prop → CTA → Destination → Trust → Next Action
- [ ] **Click a Funnel step** → browser panel syncs to that capture + timeline highlight
- [ ] **Action Timeline** shows: navigation, clicks, form fills, network requests, console errors
- [ ] **Overlay blockers** flagged if present (click-blocking modals, cookie banners)
- [ ] **Network engagement failures** flagged (401 on form submit, 5xx on API)

### 2.4 Product Contract & Remember
- [ ] **Contract editable** — add "Primary audience: B2B SaaS founders"
- [ ] **Contract saves** → persists across refresh
- [ ] **Remember strip** appears only if project has verified learnings (skip if new)

### 2.5 Responsive & Accessibility (375px / 768px / 1280px)
| Viewport | Test | Pass? |
|----------|------|-------|
| 375px (mobile) | Fix list scrolls, detail drawer works, capture comparison toggles | |
| 768px (tablet) | Two-column layout, sticky nav, no horizontal overflow | |
| 1280px (desktop) | Full layout, side-by-side captures, chat panel (if enabled) | |
| 200% zoom | All text readable, touch targets ≥44px, no clipping | |
| Reduced motion | No animations, instant transitions | |
| Keyboard only | Tab through entire report, Enter/Space activates buttons, focus visible | |

---

## Phase 3: Claim & Unlock (5 min)

### 3.1 Anonymous → Signed In
- Click the **contextual signup moment** (should be exactly one)
- **Observe**: Auth dialog is **focus-trapped** over blurred, inert report
- **Observe**: Escape key **cannot** reveal report; only "Return home" exits
- Sign up with email (or OAuth if configured)
- **Observe**: Returns to **same report**, same scroll position, same selected Flag

### 3.2 Post-Claim Verification
- [ ] **All gated prompts now unlocked** (no refresh needed)
- [ ] **Copy all fixes** button works → copies complete ranked fix list
- [ ] **Prompt quality**: Each fix is editor-ready (file, line, before/after, why)
- [ ] **No duplicate prompts** for same issue across pages
- [ ] **Report access** persists across browser close/reopen

---

## Phase 4: Apply Fix → Update Review → Diff (15 min)

### 4.1 Apply the Demonstrated Fix
- Copy the **demonstrated prompt** from Phase 1.3
- Paste into your AI editor (Cursor/Claude Code/Lovable/Bolt)
- Apply the fix
- Deploy to the **same URL** (or local preview if Studio)

### 4.2 Run Update Review
- Return to `/report/[id]`
- Click **"Update review"** (metered, uses product review credit)
- **Observe**: Fresh full capture (not incremental)
- **Observe**: Progress band shows "Comparing with previous review..."

### 4.3 Diff Verification (The Payoff Moment)
- [ ] **Before/After comparison** renders for the fixed Flag
- [ ] **Fixed Flag shows**: "Cleared" status + green check + evidence of resolution
- [ ] **Screenshot diff**: Before (red) → After (green) for affected viewport
- [ ] **No regression**: Other Flags unchanged (or new ones surfaced)
- [ ] **Release score** updates (if score shown)
- [ ] **Copy "Fixed" prompt** available for commit message / changelog

**Screenshot**: The diff view showing before/after for the fixed Flag.

---

## Phase 5: Share & Export (5 min)

### 5.1 Password-Protected Share (Studio)
- Click **Share** → "Password protect"
- Set password, copy link
- Open in **incognito/private window**
- **Observe**: Generic metadata (no project name, no owner email)
- **Observe**: Single authorize → refresh without view inflation
- **Observe**: Can open Flag details, Funnel, captures
- Revoke password → link returns 404/forbidden

### 5.2 Export
- Click **Export** → Markdown
- **Verify**: Contains complete ranked Fix list, evidence summaries, fix prompts
- **Verify**: No internal IDs, no gate strings, no private metadata

---

## Phase 6: Quality Signals Synthesis (5 min)

### 6.1 Scan Quality Scorecard
| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| False Blocker rate | 0% | | Any CRITICAL that doesn't reproduce |
| False High rate | <10% | | IMPORTANT flags that are SSR artifacts |
| Fix prompt usefulness | 100% editor-ready | | File, line, before/after, why |
| Duplicate consolidation | 0 cross-page dupes | | Same issue on /pricing + /signup = 1 Flag |
| Evidence specificity | "CTA at 394px" not "CTA below fold" | | |

### 6.2 Experience Scorecard
| Moment | Delight Signal | Friction Signal |
|--------|----------------|-----------------|
| Homepage → Report | Instant geometry, honest progress | Spinner, fake copy, layout shift |
| Finish Plan | Real evidence, 1 real prompt | Placeholder text, gate leakage |
| Fix List | Ranked by impact, filterable | Truncated, unsortable, no context |
| Claim | In-place, preserves state | Redirect, loses selection, double-submit |
| Update Review | Clear before/after, proof | Confusing diff, no evidence of fix |
| Share | Generic, revocable, no inflation | Leaks metadata, view counter bugs |

### 6.3 Trust Signals
- [ ] **No em dashes** in customer copy (per SOUL.md)
- [ ] **No banned phrases**: "re-check", "unlimited", "polish pass", "journeys/month"
- [ ] **Score ≤ 74** when any CRITICAL Flag exists (BLOCKED_RUBRIC_SCORE_CEILING)
- [ ] **Brand lockup visible** on all report states (logo + "FixFlags")
- [ ] **Help/chat accessible** from report (non-admin pages)

---

## Output Artifact: Test Report

Produce a **single markdown file** at `.agents/sessions/pi-e2e-test-{timestamp}.md` with:

```markdown
# PI Agent E2E Test Report — {ISO timestamp}

## Target: {URL tested}
## Environment: {local/production, browser, viewport}

## Phase 1: Anonymous First Scan
- Accuracy eval pre-flight: PASS/FAIL
- Progressive stages: [table with screenshots]
- Finish Plan contract: [PASS/FAIL per row with evidence]
- Demonstrated prompt quality: [editor-ready? specific? evidence-linked?]

## Phase 2: Report Workspace
- Hierarchy compliance: [PASS/FAIL per section]
- Fix list ranking quality: [top 5 Flags with rationale]
- Funnel/Replay: [functional? synced? actionable?]
- Responsive/Accessibility: [matrix with PASS/FAIL]

## Phase 3: Claim & Unlock
- Auth flow: [focus-trapped? in-place return?]
- Post-claim: [all prompts unlocked? copy all works?]

## Phase 4: Update Review & Diff
- Fix applied: [what changed]
- Update review: [fresh capture? diff accurate?]
- Before/After evidence: [screenshot + cleared Flag proof]

## Phase 5: Share & Export
- Password share: [generic metadata? revocable?]
- Export: [complete? sanitized?]

## Quality Scorecards
- Scan Quality: [table]
- Experience: [table]
- Trust: [checklist]

## Critical Findings (Blockers for Launch)
1. [Finding] — [Severity] — [Reproduction steps] — [Suggested fix]

## High-Impact Improvements (Non-Blocking)
1. [Finding] — [Impact] — [Effort] — [Suggested fix]

## Verdict
**Launch Ready: YES / NO / CONDITIONAL**
**Reason**: [One sentence]
```

---

## Execution Rules for the PI Agent

1. **Evidence over opinion** — Every claim needs a screenshot, DOM snippet, or network trace
2. **Test like a skeptical user** — If something feels "off", investigate deeper
3. **Prioritize user-value moments** — Finish Plan, Fix List, Diff are the product
4. **Document friction, not just failures** — "Took 3 clicks to see mobile capture" matters
5. **Run all 3 targets** — Patterns across targets reveal systemic issues
6. **Time-box each phase** — If a phase exceeds time, note it as a friction signal
7. **No mocking** — Use real browser, real network, real AI editor for fix application

---

## Success Criteria for "Launch Ready = YES"

- [ ] **All 3 targets** pass Phase 1 Finish Plan contract (real evidence, 1 real prompt, honest gating)
- [ ] **Zero false Blocker/Critical** flags across all targets
- [ ] **Update review diff** proves fix clearance with visual evidence on at least 1 target
- [ ] **Responsive matrix** passes at 375/768/1280 + 200% zoom + reduced motion + keyboard
- [ ] **No trust violations** (banned phrases, score/blocked mismatch, gate leakage)
- [ ] **Share/Export** work without metadata leaks
- [ ] **Total test time** < 60 min per target (if longer, it's a UX signal)

---

*This prompt is the acceptance test for FixFlags' core loop. If the PI agent passes all targets, the product delivers on its promise: "Paste URL → Finish Plan → Fix → Verify → Trust."*