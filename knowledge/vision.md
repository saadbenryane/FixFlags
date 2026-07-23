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
Understand → Improve → Verify → Remember
```

- **Understand** — Reconstruct the Product from every available signal into one coherent understanding.
- **Improve** — Present every verified unresolved Flag, ranked so the highest-leverage improvements come first.
- **Verify** — Confirm repository, runtime, journeys, visual, a11y, performance, and intended outcomes. Reality is the final source of truth.
- **Remember** — Capture verified knowledge so the Product becomes easier to evolve. Knowledge belongs to the Product.

The shipped wedge expresses this as **Flag → Fix → Re-check**. See [PRODUCT.md](../PRODUCT.md) for what ships today.

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

1. **Local runtime** — Inspect repo, portable PI files, CLI, MCP, hooks, CI; standalone value without full upload.
2. **Product Intelligence Protocol** — Vendor-neutral read/contribute API for humans, agents, and tools.
3. **FixFlags Intelligence Network** — Cloud compounding intelligence, prioritization, verification depth, collaboration.

Shipped today is primarily the cloud observer (browser scanner) plus MCP. Architecture target: [ARCHITECTURE.md](../ARCHITECTURE.md).

## Interfaces

Web, browser observer, GitHub, CLI, MCP/agent integrations, and a lightweight agent skill all connect to the same Product Intelligence. Depth varies by user (basic AI builder vs advanced team).

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

## Non-goals

Not a general coding agent, IDE, chatbot, PM tool, backlog generator, static docs generator, one-time website audit, code linter with product branding, autonomous product executive, or a system that requires surrendering ownership of product knowledge.

## Moat

Not a prompt, model, scanner, MCP integration, or Markdown files alone. The moat is persistent Product Intelligence, verified history, cross-tool continuity, proprietary quality reasoning, evidence-backed evaluation, learned prioritization, remediation outcomes, cross-product pattern intelligence, trust, workflow adoption, integrations, benchmarks, and a growing observational dataset about how AI-built products evolve.

Builders generate software. FixFlags preserves and improves the Product.

## Related

- Principles: [foundations.md](./foundations.md)
- Shipped truth: [PRODUCT.md](../PRODUCT.md)
- Near-term work: [execution.md](./execution.md)
- Business direction: [strategy.md](./strategy.md)
- Open source: [open-source.md](./open-source.md)
