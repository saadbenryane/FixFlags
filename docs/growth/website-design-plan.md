---
status: supporting
authority: interface
reviewed_at: 2026-11-10
supersedes: []
---

# FixFlags website design plan

The consolidated, phased plan that sequences this work is the [FixFlags master plan](fixflags-master-plan.md).

Saved at the owner's request on November 10, 2026. This is the website design workstream. Product competitiveness and a possible code-repair layer are assessed separately in [Elu product research and competitive plan](elu-product-research-and-competitive-plan.md). This plan does not attest that proposed behavior is shipped or replace the canonical product and design contracts.

Make this a focused redesign of how FixFlags demonstrates its value, with a much stronger developer experience and a signature animated product story.

Elu connects its promise, issue examples, code previews, and CLI entry point into a convincing story. Its website makes the product feel immediately useful. [Elu public homepage](https://elu.dev/)

FixFlags already has useful foundations: an interactive sample, evidence, copyable fix instructions, and independent rechecks. Those capabilities appear across several sections, which weakens their combined impact. [FixFlags public homepage](https://fixflags.com/)

## Define the developer promise and competitive angle

Prioritize developers and small teams shipping live websites, including people building with AI coding tools.

The proposed positioning direction is: **FixFlags finds what broke, gives your coding tool the evidence to fix it, and independently checks the result.**

That is a strategic direction for the copy, subject to supported coverage. It gives us a clear story around finding problems, acting on evidence, and knowing whether the repair worked.

Deliverables: a concise positioning brief, a claim inventory, and a homepage storyboard. Preserve the easy URL-first entry for public pages.

## Build one signature product demonstration near the hero

Bring the care requested from Archon into the choreography, transitions, and interaction details. Make the visitor understand the product through one concrete problem.

| Scene | What visitors see | What it communicates |
| --- | --- | --- |
| Check | A sample page loads, then an action fails | A working homepage can hide a broken experience |
| Flag | The failure becomes a Flag with observed and expected behavior | There is evidence behind the diagnosis |
| Fix | The visitor opens and copies the repair instructions | There is an immediate next action |
| Recheck | A separate sample execution shows the repaired behavior | Recovery requires a fresh check |

Use the same example throughout. A broken cart is a strong candidate because the failure is understandable immediately.

Let visitors pause, replay, and inspect the example. Clearly label sample data. Copying instructions must remain separate from a successful repair.

## Give the homepage a deliberate narrative

Recommended order:

1. **Hero:** a clear outcome, URL entry, and an immediate glimpse of the demonstration.
2. **Product story:** the complete failure, evidence, repair, and recheck sequence.
3. **Developer workflow:** inspect the actual instructions and see how to use them in an existing coding tool.
4. **Ongoing monitoring:** explain what happens after the first check.
5. **Coverage and trust:** show supported checks, limitations, and evidence.
6. **Pricing and final action:** make the next step straightforward.

Keep the deeper interactive dashboard available for exploration. The first screen should make sense before someone learns the dashboard.

## Create a coherent visual and motion system

Keep the folded-F identity, orange, and established typography. Build the new composition around strong product close-ups, readable evidence, confident spacing, and tonal surfaces.

Motion should have specific jobs:

- Connect a failed action to its Flag.
- Reveal the evidence behind the finding.
- Show the handoff into repair instructions.
- Distinguish checking, failure, and confirmed recovery.

Use one coordinated sequence with restrained supporting transitions. Preserve normal scrolling, readable mobile layouts, keyboard access, and a complete reduced-motion presentation. Prototype the signature sequence before producing the remaining sections. Keep [DESIGN.md](../../DESIGN.md) consistent with any accepted changes to its current hero-specific contract.

## Make the developer journey credible from click to result

The website should answer: What will you inspect? What evidence will I receive? What do I give my coding tool? How do I check the repair?

Lead with the supported instruction-copying workflow. Treat native MCP and CLI promotion as a separate milestone: the current implementation inventory says MCP customer discovery still awaits actual-client acceptance, and automatic pull requests remain parked. Those capabilities should enter the story when their acceptance evidence supports them. [Current implementation boundaries](../../PRODUCT.md)

## Ship in reviewable milestones and measure usefulness

| Milestone | Deliverable | Acceptance |
| --- | --- | --- |
| Direction | Positioning, page structure, motion storyboard | The audience, promise, and proof are clear |
| Signature experience | Responsive hero and interactive demonstration | Visitors can understand and explore the complete example |
| Complete journey | Homepage, relevant developer guidance, aligned entry flow | The demonstrated workflow matches the real product |
| Release preparation | Focused component checks, accessibility and performance review, funnel instrumentation | The experience is usable and its effect can be measured |

Measure sample engagement, check completion, evidence opened, real fix instructions copied, and return for verification. Keep sample interactions separate from real product outcomes, and establish a baseline before setting conversion targets. End-to-end testing requires an explicit owner request under AGENTS.md.

The first implementation priority is the hero and that single complete demonstration. It establishes the visual standard, motion language, and sales story for the rest of the site.
