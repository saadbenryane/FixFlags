# Site next-version readiness: 2026-09-08

## Request and outcome

Record the owner's completed “Your website, looked after” vision, remove contradictory active guidance, update the roadmap in phases, and prepare implementation. This is a documentation and planning pass. No application code, schema, entitlement, brand token, deployment or external message was changed by this pass.

The full vision is at [knowledge/vision.md](../../knowledge/vision.md). All 32 numbered sections and the closing vision are preserved; only document framing and headings changed. The superseded September 7 draft is now a pointer.

Source attachment SHA-256: 2d6cfef9f73c66dcbfb9b7f8f5f03eea230ce30bbde14621095d1c8870ae021a.
Source title: “FixFlags Product Vision Your website, looked after.”
Owner source path at preparation time: /Users/saadbenryane/.codex/attachments/757010d3-29fd-4119-9788-aa840891c079/pasted-text.txt.

## Implementation package

- [Phased roadmap](../../ROADMAP.md): dependencies, exit evidence and decisions due at each phase.
- [PRD](../../docs/product-prd.md): domain contract, ordered first slice and behavior acceptance.
- [Interface](../../docs/workspace-interface.md): Home · Flags · Site, progressive detail and state matrix.
- [Migration/reuse](../../docs/site-v2-migration.md): current models, tenant boundaries, adapters, history, billing and cutover.
- [Vision coverage](../../docs/site-v2-vision-coverage.md): each part of the source mapped to implementation phases.
- [Evidence rules](../../knowledge/evidence-rules.md): certainty, coverage, freshness and independently verified recovery.

## Reconciliation

Replaced active report/AI-builder positioning in vision, product knowledge, strategy, brand/voice, design, PRD, roadmap, execution, README and goal entrypoint. Updated agent/product/design/marketing/completeness guidance and duplicate Cursor references. Scoped old report and Finish Plan mechanics to compatibility. Retired stale launch copy, pricing assumptions and growth direction. Previous decisions and Shopify/paid-traffic plans retain historical evidence but no longer govern the new product.

[PRODUCT.md](../../PRODUCT.md) now describes current implementation and explicit gaps instead of presenting the Site ambition as shipped. Current public copy and runtime surfaces still require phased implementation and rollout; their presence in the tree is not new-version completion.

## Foundations and risks

Retain brand identity, auth, accounts, plans, Stripe/billing, safe Playwright evidence, queues/recovery, private Project understanding and historical attempts. Reuse Shopify auth/probes as a connection into the same Site.

Prisma Site/Page currently map to shared graph tables. They must not become private customer tenancy accidentally. Existing owned Project is a safer initial backing for the Site projection. Account claim, durable scheduling, free monitoring economics, old public links, private connection data and subscriber migration need the acceptance gates in the plan.

## Workspace boundary

Observed HEAD: 201c14e08cb32dc247a4458f3821a8011386de07. The working tree already contained extensive unrelated and shared application work. Preserved that work; did not reset, stage all, commit, tag, push or deploy. HEAD does not capture all existing uncommitted changes. A reconciled checkpoint remains an implementation prerequisite before broad application migration.

## Verification

- npm run agent and board/Git inspection completed before writes.
- npm run doctor passed for the local prerequisites.
- npm run completeness:audit passed before and after reconciliation.
- npm run agent -- verify --dry-run selected the full suite because unrelated shared runtime/validation changes are already in the workspace.
- Used the justified documentation-only equivalent: npm run agent -- eval docs, npm run skills:validate, npm run knowledge:duplication-guard, git diff --check, source-fidelity comparison, local Markdown link checks and manual active-guidance review.
- Documentation evaluation log: .agent-runs/2026-09-07T23-26-01-273Z-eval-docs.log.
- Full owner-text comparison passed; numbered sections are exactly 1 through 32.
- Runtime/release tests are not a claim of this pass. No v2 launch or deployed readiness is asserted.

## Next implementation task

Start Phase 1 from the PRD: one private customer Site, pages/actions, inferred editable Outcomes, normalized coverage/evidence and durable Flag identity. Use a controlled contact-flow fixture with healthy, broken and unverified behavior, then carry it into the same-Site dashboard in Phase 2. No further vision approval is required to start.

Do not begin with a company-wide code rename, all integrations, a new orange or another report redesign.
