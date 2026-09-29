# FixFlags completion plan

**Date:** 2026-09-29. **Branch:** `main`. **Author:** opencode.
**Status:** plan of record. Waves 0 to 4. Every claim below is cited to code I read on this date.

## 1. The honest state in one paragraph

FixFlags has a real, working, trustworthy core: Playwright capture, the check engine, the Audit
run ledger, Flags with evidence, a genuine Flag → Fix → Verify loop whose recovery step is a
fresh comparable execution, Watch, MCP transport, tenant-isolated Sites, and a build that passes.
What it cannot do is answer the **first** question the vision asks (`knowledge/vision.md:15-22`):
*What matters?* For any customer except a storefront selling checkout, the answer is a page-load
check. Everything else in this plan is either downstream of that gap or is a claim the product
currently makes that it cannot back.

## 2. The finding that reframes the rest

`BROWSER_JOURNEY` is a misleading name. `runPathProbe`
(`lib/integrity/run-path-probe.ts:42-225`) is hardcoded to a **purchase path**:
`selectFirstAvailableVariant`, `discoverBuyControl`, `cartAppearsUpdated`, `isCheckoutUrl`,
`shopPayVisible`. There is no generic browser walk anywhere in the repo.

So the "three mechanisms" are really:

| Declared | Reality |
| --- | --- |
| `BROWSER_JOURNEY` | one commerce walk, hardcoded goal |
| `HTTP_AVAILABILITY` | a real `fetch` (`checkout-execution.ts:215`) |
| `SAFE_FORM` | 128 lines of real executor at `lib/sites/application/safe-form-executor.ts`, imported **only by its own test** |

Consequences that are all provable today:

- Every Outcome kind except `CHECKOUT` and `AVAILABILITY` is a promise FixFlags cannot keep.
- `syncOutcomesFromAudit` (`lib/sites/outcomes.ts:241-272`) creates one `SiteOutcome` per journey
  type with **no kind**, so every inferred Outcome is `GENERIC`, unwatchable, invisible on Home, and
  visible only in Settings. Production: 9 Outcomes, all `GENERIC`, 0 confirmed.
- That same function can create a duplicate: a journey typed `purchase_flow` yields a `GENERIC`
  slug `purchase-flow` **and** the `checkoutSignal` block (`outcomes.ts:274-332`) upserts a separate
  `CHECKOUT` slug. Two rows, one meaning.
- The owner decision parked in `.agents/learnings/the-outcome-loop-has-never-been-entered.md`
  ("widen what FixFlags can verify" vs "keep inference internal") could not be answered by either
  option, because nobody had established that the mechanism is commerce-only. That is the blocker.

**Therefore Wave 1 is not a feature. It is the mechanism the product has been claiming to have.**

## 3. Wave 0 — stop saying things that are false

Ship-blocking on trust, small, do first.

| # | Defect | Evidence | Proper fix (not a fallback) |
| --- | --- | --- | --- |
| 0.1 | The public MCP guide names three tools that do not exist. Registry is `fixflags.list_sites`; docs say `ff_list_sites`. | `content/docs/mcp.md:18-23` vs `lib/mcp/tool-registry.json` | **Derive the tool table from the registry** so the two cannot disagree, and add a test that fails when they do. |
| 0.2 | MCP is fully public and actively pinned as not-parked, while `AGENTS.md` and ROADMAP Gate 3 require it to stay undiscoverable until the loop and authorization are proven. A test asserts the opposite of the invariant. | `lib/__tests__/public-product-scope.test.ts:36-44`, `proxy.ts:27-40`, `lib/docs/catalog.ts:92-107` | Obey the invariant: unlist `/docs/mcp`, park the `.well-known` discovery endpoints and `/dashboard/mcp-setup`, invert the test that pins it open, and write the **executable** Gate-3 proof that earns discovery back. Transport stays reachable for authorized accounts. |
| 0.3 | The web Verify path writes a fix attempt whose `changeSummary` is the Outcome's **expectedBehavior**. The attempt history claims a change that nobody recorded. | `lib/sites/application/commands.ts:142`; `app/api/sites/[siteId]/flags/[flagId]/fix/route.ts` only accepts `action: 'copy'` | Collect what actually changed, or record no change. Fabricated provenance in the one place the product promises independence. |
| 0.4 | A single GREEN integrity probe writes `Improvement.status = 'VERIFIED'` with no attempt and no verifier row, bypassing the comparability gate; it reaches the customer through the Site Agent. | `lib/integrity/site-flag.ts:43-47`, `lib/sites/application/agent.ts:111` | One meaning of "verified". Route the probe through the same gate or stop writing `VERIFIED` from a probe. |

## 4. Wave 1 — make "What matters?" answerable

1. **One real generic browser journey.** A declarative goal: start URL, steps expressed as user
   intent (role/label, not a CSS selector), a goal predicate, and a `Couldn’t verify` reason when the
   goal is unreachable. One runner. Retire the commerce-only name.
2. **The vision's own examples become configs, not bespoke runners:** Login, Signup, Password reset.
   Each is data over mechanism 1. This is the difference between one Outcome kind and twenty.
3. **Retire the ghost layer.** Inference classifies a journey to a kind or creates no Outcome row at
   all. No unwatchable rows in Settings, no duplicate checkout.
4. **Then decide `SAFE_FORM` properly.** Either build the authorized-fixture contract (test account,
   reversible reset) so Signup is verifiable on the customer's real form, or delete the executor.
   Leaving 128 live lines nothing can call is neither.

## 5. Wave 2 — finish the loop

- **Outcome detail** is missing 4 of 7 elements the IA requires: evidence, executions, history, and
  the mechanism. Today a `Couldn’t verify` has no stated reason and no recovery action, which
  `docs/workspace-interface.md` explicitly forbids.
- **`Fix` records what changed** (the 0.3 work), and the attempt history stops lying.
- **Per-Outcome enable/disable**, listed at `docs/product-architecture.md:61`, does not exist.
- **Freshness:** `staleAfterMinutes` has a default of 11520 and **no writer in the codebase**. Either
  make it a real per-Outcome setting or state the constant honestly and stop calling it a policy.

## 6. Wave 3 — IA and interface

- `app/sites/error.tsx` does not exist. An error inside a Site drops the customer onto a
  marketing-shell page back to `/dashboard`, losing Site identity, which
  `docs/workspace-interface.md:65` explicitly forbids. There is no `loading.tsx` either.
- **Flags:** "Recovery and recurrence" is a static paragraph with no data behind it. Share and
  "View technical details" are missing.
- **Mobile** is Home · Flags · Settings; the IA says Home · Flags · **More**.
- **Settings** puts Outcomes last; the IA lists them first.
- **Remove the forbidden scores-first residue:** `components/product/ProductWorkspace.tsx` (~600
  lines rendering `ScoreRing` and `RubricScoreBar`, kept alive only by its own test),
  `ProductReviewAction.tsx`, `ProductOverviewGrid.tsx`, `lib/mcp/report-command-copy.ts`,
  `BoardCardView.score` (hardcoded `null`), the customer-visible "Score 92" string, and the
  "Broader health and recommendations" heading that promises recommendations that never render.
- **Uptime and Accessibility** cards exist in the catalog and are unreachable in-product.
- **~110 hardcoded customer strings** live in `components/sites/**` and `app/sites/**`, against the
  copy invariant that lives in `lib/marketing/copy/`.

## 7. Wave 4 — verify and release

`npm run agent -- verify` clean, deploy, then re-read production to confirm Outcomes are actually
watchable, and run the Gate-3 MCP proof on a real credentialed account before re-listing MCP.

## 8. Refused designs, and why

| Refused | Reason |
| --- | --- |
| A "proposal" / "coming soon" Outcome state | Converts a loud gap into a quiet dead end. That is the same failure as the `SIGNUP` binding, with better manners. |
| A generic AI-judge Outcome | A judge cannot prove an outcome was restored. It would break the independence the product exists to provide. |
| Any surface implying coverage FixFlags lacks | Violates `knowledge/evidence-rules.md` and the coverage invariant. |
| Re-adding `/api/mcp` to the public surface before the proof exists | This is the claim-before-proof failure, one level up. |

## 9. Ownership boundaries for this work

Avoid, because another agent is in them: `lib/sites/coverage.ts`, `lib/sites/site-health.ts`,
`lib/sites/__tests__/card-areas.test.ts` (`site-coverage-freshness-2026-09-29`, codex, in-progress)
and the JEV experiment files (`restore-ci-triage-adapter-2026-09-29`).
