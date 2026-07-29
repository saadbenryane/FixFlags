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
- Deeper frameworks, research methods, channel guidance, and templates: `references/marketing-playbook.md`.

## Procedure

1. Choose one reader and trigger moment: an AI shipper preparing to share a build, or a site owner diagnosing weak conversion.
2. State audience, job, promise, proof, and path in that order.
3. Lead with customer verbs and real output: evidence, Flags, fix prompts, and Re-check proof.
4. Resolve every feature, quota, timing, integration, and support claim against shipped code or measured evidence.
5. Put visible copy in typed modules exported through `lib/marketing/copy.ts`; do not hardcode it in components.
6. Check that artwork containing illustrative text follows the generated-art manifest and product terminology.
7. Run the product-contract, SEO, voice, artwork, and relevant UI/browser guards.

## Audience framing

| Reader | Trigger | Lead promise | Proof |
|---|---|---|---|
| AI shipper | Before launch, demo, or sharing an AI-built product | Catch release gaps and get editor-ready fixes | Curated sample, evidence, fix prompt, Re-check |
| Site owner | Traffic exists but conversion or trust is weak | See what is costing signups and what to fix first | Their URL, prioritized evidence, verified improvement |

Do not mix both readers in one hero or block.

## Voice

- Calm, concrete, concise, builder-to-builder.
- Use short sentences and customer verbs.
- No em dashes, fake urgency, unsupported superlatives, invented social proof, or vague AI/platform filler.
- Name the mechanism and boundary.
- Use `Re-check` in user-facing copy. `Monitoring` remains internal unless Product Watch is the named surface.
- Use `Message`, `Experience`, and `Reach` as the only report rubrics.

## First-value contract

1. Logged-out primary action is the free check (`Review my site` → `/#audit`), not account creation.
2. Account creation belongs after triage value.
3. Live anonymous reports show evidence and exactly one demonstrated prompt; remaining prompts stay gated.
4. `/samples` is the canonical curated sample Finish Plan.
5. Never present a curated sample as a live customer review.

## Homepage contract

Preserve this order unless the canonical landing copy changes:

1. Hero
2. Sample report
3. Check → Fix → Re-check loop
4. Message, Experience, and Reach dimensions
5. Benefits and builder workflow
6. MCP workflow
7. Final URL CTA
8. Footer

Primary illustrations are generated compositions. Do not replace approved artwork with CSS drawings, icon approximations, placeholder panels, or DOM text layered over blank plates.

## Entitlement language

- Free includes three new URL checks.
- Re-checks on owned reports are free and unlimited.
- Pro includes 25 new URL checks per month.
- Do not say "unlimited checks" or hardcode volatile prices and quotas in this skill.

## Avoid

- Unshipped capabilities, five-rubric UI, fabricated performance, unsupported automation, or obsolete integrations.
- Lighthouse categories, `Run Audit`, or internal monitoring language on marketing surfaces.
- Competing CTA labels that skip the proof surface.
- Ornament before message, proof, and path are correct.
