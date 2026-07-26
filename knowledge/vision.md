# Vision

**Canonical home for the FixFlags product vision.** Do not restate this narrative elsewhere. Link here.

## One-sentence definition

FixFlags is the independent Product Intelligence System that helps humans and AI continuously understand, improve, verify, and evolve a product without losing what makes it valuable.

## Tagline

Finish what your AI started.

## Mission

Help every AI-built product become a complete, coherent, useful, trustworthy, and continuously improving product.

FixFlags does not exist to generate more software. It exists to improve the quality of the product being generated.

## The problem

AI made software implementation abundant. Products become fragmented, unfinished, inconsistent, and disconnected from their original purpose. Every prompt changes part of the product. Different agents optimize local tasks. Nobody continuously protects the product as a whole.

The scarce resource is product judgment.

## Core insight

Every evolving product needs an independent intelligence that continuously understands what the product is, why it exists, who it serves, how it should behave, what currently exists, what changed, where it is drifting, what should improve next, and whether a change actually made it better.

This intelligence must persist across models, agents, IDEs, repositories, deployments, contributors, and years of evolution.

## Core object

**The Product** — not the repository, website, code, prompt, deployment, or documentation. Those are signals. Everything in the system should ultimately improve the Product.

## Product identity

Every product has an intended identity and an actual current state. The distance between them creates unfinished work, drift, inconsistency, debt, UX failures, weak positioning, and broken journeys. FixFlags continuously reduces that distance.

## Core loop

```
Check → Fix → Verify → Watch
```

- **Check** — Test the public surface of the product. Find the routes, links, actions, and journeys. Run deterministic checks and AI review.
- **Fix** — Show exactly what happened, provide evidence, and send a bounded fix into the customer's builder.
- **Verify** — Run the same test again. Confirm the repair worked. Before-and-after comparison.
- **Watch** — Attach to deployments, important journeys and previously verified fixes. Detect regressions.

The unit of value is a verified fix. See [PRODUCT.md](../PRODUCT.md) for what ships today.

The deeper vision loop remains **Understand → Improve → Verify → Remember**. See [product-system.md](./product-system.md) for the three connected products.

## Product Intelligence vs Integrity Engine

| Layer | Owner | Role |
|-------|-------|------|
| **Product Intelligence** | Customer | Persistent, customer-specific understanding of one Product |
| **Integrity Engine** | FixFlags | General reasoning and evaluation across products |

Detail: [product-intelligence.md](./product-intelligence.md), [integrity-engine.md](./integrity-engine.md).

Founding privacy principle: **FixFlags never learns your product. It learns how to understand products.** See [privacy.md](./privacy.md).

## Fix List

The main output answers: **What should we improve next?** Prioritized, scoped, evidence-backed, actionable, verifiable, continuously updated. See [finish-plan.md](./finish-plan.md).

## Product Integrity dimensions

The Integrity Engine evaluates across five dimensions (Product, Experience, Design, Implementation, Agent). User-facing report rubrics remain **Message / Experience / Reach** until the thesis is validated. Mapping: [integrity-engine.md](./integrity-engine.md).

## System layers (target)

1. **Local runtime** — Inspect repo, portable PI files, CLI, hooks, CI; standalone value without full upload.
2. **Product Intelligence Protocol** — Vendor-neutral read/contribute API for humans, agents, and tools.
3. **FixFlags Intelligence Network** — Cloud compounding intelligence, prioritization, verification depth, collaboration.

Shipped today is primarily the cloud observer (browser scanner) plus MCP. Architecture target: [ARCHITECTURE.md](../ARCHITECTURE.md). Technical architecture spec: [technical-architecture-spec.md](./technical-architecture-spec.md).

## Interfaces

Web, browser observer, GitHub, CLI, MCP/agent integrations, and a lightweight agent skill all connect to the same Product Intelligence. Depth varies by user (basic AI builder vs advanced team).

Detail: [technical-architecture-spec.md](./technical-architecture-spec.md).

## Initial wedge (near-term)

1. Connect a deployed AI-built product.
2. Optionally connect its repository.
3. Reconstruct basic Product understanding.
4. Inspect the real experience.
5. Identify highest-impact gaps.
6. Produce a complete ranked Fix List.
7. Produce fixes / agent-ready instructions.
8. Re-check.
9. Record what improved.
10. Keep Product Intelligence current.

The core loop is now **Check → Fix → Verify → Watch**. See [product-system.md](./product-system.md) for the three connected products.

## Product principles

- The Product is the core object.
- User value matters more than code output.
- Understanding precedes action.
- Verification precedes confidence.
- Evidence precedes recommendations.
- Prioritization guides action without hiding verified issues.
- Product Intelligence must remain portable.
- Privacy must be understandable.
- The system must remain vendor-neutral.
- Basic users receive simple outcomes; advanced users receive deep control.
- The open layer creates adoption; the intelligence layer creates compounding value.
- Every session should leave the Product easier to evolve.
- Avoid complexity without proven user value.
- Improve products; do not merely produce reports.
- Show what happened — every important conclusion must point to an observable moment.
- Test a job, not a fictional persona — the task matters more than an invented identity.
- Never hide uncertainty — say "Could not verify" when it cannot prove success or failure.
- Critical means confirmed — a finding cannot be critical because a language model dislikes something.
- Outside-in first — test the product that customers can actually access.
- Fix and verify in the same loop — a recommendation without a re-check is incomplete.
- Earn the right to run continuously — do not ask for GitHub, deployment or credential access before demonstrating value on a public URL.
- Make scope visible — the user must know exactly what was and was not checked.

Detail: [evidence-rules.md](./evidence-rules.md).

## Non-goals

Not a general coding agent, IDE, chatbot, PM tool, backlog generator, static docs generator, one-time website audit, code linter with product branding, autonomous product executive, or a system that requires surrendering ownership of product knowledge.

Not an AI website audit, autonomous QA agent, synthetic user platform, or test-generation tool. The independent system between the AI builder and the live product.

## Moat

Not a prompt, model, scanner, MCP integration, or Markdown files alone.

### Near-term moat
Strong brand, better report design, higher finding precision, evidence-first trust, fast fix and verify loop, cross-builder independence, excellent distribution through free checks, agency workflow.

### Medium-term moat
Persistent product and journey memory, saved success assertions, verified history across deployments, change-to-journey mapping, builder and deployment integrations, evaluation benchmark, customer-specific standards.

### Long-term moat: The verified outcome graph
Product pattern → journey → observed problem → accepted fix → deployed change → verified result.

Detail: [growth.md](./growth.md#defensibility).

Builders generate software. FixFlags preserves and improves the Product.

## Related

- Principles: [foundations.md](./foundations.md)
- Three products: [product-system.md](./product-system.md)
- User journey: [user-journey.md](./user-journey.md)
- Evidence rules: [evidence-rules.md](./evidence-rules.md)
- Growth: [growth.md](./growth.md)
- Shipped truth: [PRODUCT.md](../PRODUCT.md)
- Near-term work: [execution.md](./execution.md)
- Business direction: [strategy.md](./strategy.md)
- Open source: [open-source.md](./open-source.md)
