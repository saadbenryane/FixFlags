# Product-Truth Audit — release-facing claims vs. shipped truth

- **Date:** 2026-08-11
- **Scope:** Release-facing copy only — marketing copy source (`lib/marketing/copy.ts` + `lib/marketing/copy/*`), marketing UI components (`app/components/marketing`, `app/(marketing)` pages), public docs (`content/docs/*.md`), Help Center (`lib/help/`), and CLI/MCP surface (`fixflags-cli/`, `lib/mcp/tool-manifest.ts`).
- **Method:** Read canonical shipped-truth sources (`PRODUCT.md`, `knowledge/vision.md`, `legal.ts`), then grep every candidate claim pattern with file:line output. Report-only — no files were edited.
- **Verdict:** ZERO VIOLATIONS. A small set of technically-accurate phrases are flagged RISK for clarity tightening so no reader can mistake the user's coding agent for a FixFlags auto-fixer.
- **Escalation:** NOT triggered. Escalation fires only on a VIOLATION; none found.

## Shipped vs. aspirational (reference)

From `PRODUCT.md` "Current capabilities (verified)" and `knowledge/vision.md` "SHIPPED / NEXT / VISION":

- **SHIPPED:** URL review → deterministic checks + AI triage on screenshots → ranked Fix List → editor-ready fix prompts (gated behind claim/sign-up for the full per-flag set) → update review/re-check with before/after diff → product watch (Pro/Studio). MCP tool surface (`ff_check_and_plan`, `ff_get_all_fixes`, `ff_plan_mode_prompt`, `ff_recheck_and_compare`, etc.). Free/Pro/Studios plans. Product Contract as the shipped seed of Product Memory.
- **VISION (NOT shipped):** Product Graph, global intelligence, multi-signal Flag synthesis, "Fix it for me" (path #3 in vision §Fixing), autonomous product creation, continuous self-improvement, support-as-a-signal. vision.md explicitly says the Product Graph "does not need to be implemented literally as a graph today" and "Do not claim proprietary global intelligence before we have it." This is internal knowledge, not release-facing.

## Claim audit table

| # | Claim class (candidate violation) | Location searched | Match (file:line) | Verdict | Suggested fix wording (text only — not applied) |
|---|---|---|---|---|---|
| 1 | Product Graph / Product Intelligence as a shipped capability | all release copy + docs | (none) | CLEAR | — |
| 2 | Global intelligence / "anonymized/generalized system learning" as shipped | all release copy + docs | (none) | CLEAR | — |
| 3 | Multi-signal Flag synthesis (combining support/analytics/session/error signals) | all release copy + docs | (none) | CLEAR | — |
| 4 | "Fix it for me" / auto-fixing by FixFlags | all release copy + docs | (none) | CLEAR | — |
| 5 | "AI that fixes your product" | all release copy + docs | (none) | CLEAR | — |
| 6 | Invented testimonials or named customer quotes | all release copy + docs | (none) | CLEAR | — |
| 7 | Invented member/customer counts ("thousands/millions of customers") | all release copy + docs | (none); guard-rail comments at `landing.ts:13`, `landing.ts:19` actively forbid these | CLEAR | — |
| 8 | Review-volume stats ("thousands/millions of reviews") | all release copy + docs | (none) | CLEAR | — |
| 9 | Waitlist discount offer (first 500 / next 500) | `seo.ts:16-17` | `seo.ts:16-17` ("first 500 waitlisters per plan get 25% off... next 500 get 15% off. Sign up required.") | CLEAR | This is a genuine, enforced promise (Stripe promotion codes with `max_redemptions` caps; see `docs/stripe-setup.md`, `docs/launch-checklist.md`). Keep as-is. |
| 10 | Promised free-tier value vs. metered update reviews | `landing.ts:8`, `brand.ts:50`, `auth.ts:294` | `landing.ts:8` ("the next fix"), `auth.ts:294` ("Free includes 3 product reviews lifetime... Update reviews use the same product review credits") | CLEAR | — |
| 11 | Fix prompts available to anonymous (previously a VIOLATION per 2025 launch-promise-audit G7) | `landing.ts:41`, `landing.ts:70`, `landing.ts:126` | `landing.ts:41` ("Sign up to get a fix prompt for every Flag"); `landing.ts:70,126` ("Writes fix prompts your agent runs **after signup**") | CLEAR | The 2025 promise-gap (G7 "Every Flag comes with a fix prompt") is RESOLVED — copy now gates per-flag prompts behind sign-up. |
| 12 | RISK: "your agent fixes them" could be read as FixFlags auto-fixing | `landing.ts:142` | `landing.ts:142` — MCP_SECTION.body: "Connect via MCP so **your agent** finds Flags, **fixes them**, and runs update reviews without copy-pasting URLs." | RISK | Grammatically "your agent" owns "fixes them" (accurate: the user's coding agent applies the fix via MCP tools; FitFlags supplies prompts/tools, not auto-fixes — vision path #2, shipped). Tighten to remove any ambiguity: "Connect via MCP so your agent pulls Flags and fix prompts, then fixes and re-checks via the MCP tools." |
| 13 | RISK: "gives you clear fixes" (loose noun) | `landing.ts:569` | `landing.ts:569` — HOW_IT_WORKS.hero.subhead: "FixFlags analyzes your product, highlights what matters, and **gives you clear fixes** so you can publish when you are ready." | RISK | "fixes" should be "fix prompts" to match the gated contract (anonymous get one demonstrated prompt; full set after sign-up). Wording: "…gives you clear fix prompts so you can publish when you are ready." |
| 14 | RISK: "turns every Flag into a ranked, editor-ready fix" | `landing.ts:792` | `landing.ts:792` — sampleReport.body: "…then turns every Flag into a ranked, editor-ready **fix**." | RISK | "fix" could imply applied change rather than a prompt. Wording: "…then turns every Flag into a ranked, editor-ready **fix prompt**." |
| 15 | RISK: "your agent check, fix, and Update review" | `landing.ts:778` | `landing.ts:778` — integrationsBlock.body: "On Pro, MCP lets your agent check, fix, and Update review without leaving the editor." | RISK | Accurate (agent acts; FitFlags supplies tools), but "fix" as a verb is ambiguous. Wording: "On Pro, MCP lets your agent check, apply fixes, and Update review without leaving the editor." |
| 16 | Positive: explicit no-guarantees disclaimer | `legal.ts:14` | `legal.ts:14` — "FixFlags provides Product QA reviews and fix prompts... Report results are guidance for your own review, **not guarantees** of production readiness, compliance, accessibility certification, or legal advice." | CLEAR | — |
| 17 | Positive: honest trust line (integration list, not counts) | `landing.ts:20` | `landing.ts:20` — trustLine: "Works with Cursor, Claude Code, Lovable, Bolt, and more" | CLEAR | — |
| 18 | Positive: MCP how-it-works transcripts attribute fixing to the agent, not FixFlags | `landing.ts:149-156`, `landing.ts:307-310` | transcript shows "Claude applies fixes" / "Agent applies: mobile CTA layout fix" then calls `ff_recheck_and_compare` | CLEAR | — |

## Verification output

Consolidated grep across the canonical release surfaces (`lib/marketing/copy.ts`, `lib/marketing/copy/*.ts`, `app/components/marketing`, `app/(marketing)` pages). Each candidate pattern is shown with match count:

```
product graph                matches=0
global intelligence          matches=0
multi-signal                 matches=0
fix it for me                matches=0
auto-fix                     matches=0
autofix                      matches=0
self-healing                 matches=0
thousand                     matches=0
million                      matches=0
trusted by:                  matches=0
used by:                     matches=0
powered by AI that           matches=0
understands your product     matches=0
continuously                 matches=0
testimonial                  matches=1
case study                   matches=0
member count                 matches=1
customer count               matches=0
AI that fixes                matches=0
```

The two non-zero hits are guard-rail *comments*, not claims:

```
lib/marketing/copy/landing.ts:13  /** Honest product assurances only. No invented counts or testimonials. */
lib/marketing/copy/landing.ts:19  /** Product-true trust line only. No invented member counts or stock avatars. */
```

Additional targeted searches run (all return 0 release-facing matches unless noted):
- Unshipped-capability phrases (`product graph|global intelligence|multi-signal|fix it for me|auto-fix|self-healing`) across `app/`, `components/`, `lib/` → only matches are in (a) audit *check definitions* that generate fix text telling customers NOT to fabricate stats/testimonials (`lib/audit/checks/slop.ts`, `conversion-friction.ts`, `trust-psychology.ts`), and (b) demo *fixtures* (`lib/demo/fixtures/*.ts`) which are the scanned *subject* pages, not FitFlags claims. Neither is release-facing FitFlags copy.
- Soft capability language (`AI reviewer|powered by|self-healing|autonomous|guarantee|best-in-class|100%`) across `content/docs/*.md` → 0 matches.
- MCP tool `desc` strings (`lib/mcp/tool-manifest.ts:9-79`) → all describe user/agent actions ("Get …", "Generate …", "Mark …"), none claim FitFlags auto-fixes.
- `fixflags-cli/` README + src → 0 matches for any unshipped pattern.
- `llms-txt.ts`, `display-meta.ts`, `metadata.ts`, `structured-data.ts` → 0 matches.

## What is NOT release-facing (checked, excluded as internal)

These files contain aspirational/operational content but are NOT customer-visible release copy, so they are not VIOLATIONS — they are cited for transparency:

- `knowledge/vision.md` — defines SHIPPED / NEXT / VISION; explicitly keeps Product Graph, "Fix it for me", global intelligence under VISION/NEXT. Internal.
- `docs/product-prd.md:68` — "5. Learn (Product Passport + global intelligence)" appears in an internal strategy flow diagram (VISION label). Internal.
- `docs/year-1-operating-plan.md` — "600+ paying customers" target (p.30, p.166). Internal planning forecast, not rendered to users.
- `docs/growth/decision-log.md:54` — "tens of thousands of sites" (future scale narrative). Internal.
- `docs/iteration-log.md:2297` — "Do not suggest invented customer counts, fake press" (an instruction to the agent, not a claim). Internal.
- `docs/investigations/launch-promise-audit.md` (2025) — the prior gap audit this work supersedes. Internal.

## Caveats & limits

1. This audit is grep-driven over copy *source files* and *page components*. It does not render every page in a browser, so it cannot catch capability claims assembled at runtime from DB/JSON (e.g., per-check Flag/fix text generated dynamically). The Flag/fix text generator (`lib/audit/flag-copy.ts`, `verification-rules.ts`) was scanned and contains only fix instructions addressed to the user, not FitFlags self-claims.
2. The 2025 `launch-promise-audit` (G1/G7) flagged the anonymous funnel for over-promising per-flag prompts. The current copy has since been corrected to gate prompts behind sign-up (see rows 11, 18). This audit confirms the copy is now compliant; it does not re-validate the runtime entitlement behavior, which the earlier audit already documented.
3. "Agent reads screenshots" (faq.ts:20, landing.ts:40, landing.ts:52) is a SHIPPED AI-triage capability and is reported accurately; no LLM-only judgment is attributed to deterministic certainty (consistent with PRODUCT.md "Evaluation system" and vision §Human-aligned AI).
4. No files were modified. The four RISK items (rows 12-15) are flagged for the Content/Brand crew, which owns `lib/marketing/copy/*`.
5. The repo has large uncommitted working-tree changes per the captain's brief; this audit is read-only (grep + read) and preserved all work.
