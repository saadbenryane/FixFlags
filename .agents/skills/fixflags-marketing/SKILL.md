---
name: fixflags-marketing
description: Research, write, and validate FixFlags positioning and conversion copy without drifting from shipped product behavior, voice, or evidence.
---

# FixFlags marketing

Use this skill for FixFlags marketing research, positioning, homepage copy, conversion paths, and claim validation.

## Required context

Read only what the task needs:

- Always: `AGENTS.md`, `PRODUCT.md`, `docs/voice-and-copy.md`, and `lib/marketing/copy.ts`.
- Positioning: `knowledge/vision.md`.
- Sample or report promises: `knowledge/report-contract.md`.
- Entitlements: the fixflags-product skill and shipped billing code.

## Procedure

1. Choose one reader and trigger moment: an AI shipper preparing to share a build, or a site owner diagnosing weak conversion.
2. State audience, job, promise, proof, and path in that order.
3. Lead with customer verbs and real output: evidence, Flags, fix prompts, and update-review receipts.
4. Resolve every feature, quota, timing, integration, and support claim against shipped code or measured evidence.
5. Put visible copy in typed modules exported through `lib/marketing/copy.ts`; do not hardcode it in components.
6. Check that artwork containing illustrative text follows the generated-art manifest and product terminology.
7. Run the product-contract, SEO, voice, artwork, and relevant UI/browser guards.

## Audience framing

| Reader | Trigger | Lead promise | Proof |
|---|---|---|---|
| AI shipper | Before launch, demo, or sharing an AI-built product | Catch release gaps and get fixes to paste into the builder | Curated sample, evidence, fix prompt, update review |
| Site owner | Traffic exists but conversion or trust is weak | See what is costing signups and what to fix first | Their URL, prioritized evidence, verified improvement |

Do not mix both readers in one hero or block.

## Voice

- Calm, concrete, concise, builder-to-builder.
- Use short sentences and customer verbs.
- No em dashes, fake urgency, unsupported superlatives, invented social proof, or vague AI/platform filler.
- Name the mechanism and boundary.
- Use `Update review` and `Update reviews` in user-facing copy. Internal routes, analytics, enums, and the compatibility CLI command may retain `re-check` or `recheck`.
- Copying a fix prompt is a handoff. Only an `IMPROVED` receipt from a fresh completed update review may say an Improvement is verified or improved.
- Use `Message`, `Experience`, and `Reach` as the only report rubrics.

## First-value contract

1. Logged-out primary action is the free check (`Review my site` → `/#audit`), not account creation.
2. Account creation belongs after triage value.
3. Live anonymous reports show deterministic Agent progress and every confirmed Flag with evidence. They show Fix Prompt / Copy prompt chrome that opens create-account. Prompt bodies, Timeline payload, update-review actions, and lifecycle mutations stay gated.
4. `/samples` is the canonical curated workspace. It exposes the complete ranked Fix list, exactly one demonstrated per-Flag prompt, its versioned static Timeline, no aggregate Finish Plan prompt, and no update-review action.
5. Never present a curated sample as a live customer review.

## Homepage contract

Preserve this order unless the canonical landing copy changes:

1. Hero
2. Sample report
3. Flag → Fix → Update review loop
4. Message, Experience, and Reach dimensions
5. Benefits and builder workflow
6. MCP workflow
7. Final URL CTA
8. Footer

Primary illustrations are generated compositions. Do not replace approved artwork with CSS drawings, icon approximations, placeholder panels, or DOM text layered over blank plates.

## Entitlement language

- Free includes three product reviews per month for one Product.
- Every signed-in manual update review uses one product-review credit.
- Completed scheduled reviews use one product-review credit and are available on Studio.
- Pro includes 30 product reviews per month across up to five Products.
- Studio includes 90 product reviews per month, unlimited Products, scheduled reviews, and workspace invitations.
- Do not say "unlimited checks" or hardcode volatile prices and quotas in this skill.

## Avoid

- Unshipped capabilities, five-rubric UI, fabricated performance, unsupported automation, or obsolete integrations.
- Lighthouse categories, `Run Audit`, or internal monitoring language on marketing surfaces.
- Competing CTA labels that skip the proof surface.
- Ornament before message, proof, and path are correct.
