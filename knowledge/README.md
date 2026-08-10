# Knowledge Architecture

The project knowledge system is the shared intelligence between humans and every AI agent that works on FixFlags. It is the persistent memory of the product.

This document is the master index. It defines the architecture, rules, and navigation for all project knowledge.

---

## Design Principles

1. **One concept, one canonical source.** Every piece of knowledge lives in exactly one document. Other documents reference it; they do not repeat it.
2. **Separate stable from evolving.** Principles that rarely change live apart from facts that change weekly.
3. **Separate philosophy from implementation.** Why we exist is not the same as how we build it.
4. **Separate product from technical.** What FixFlags does is not the same as how it works.
5. **Every document answers one primary question.** If a document answers multiple unrelated questions, it is too broad.
6. **Documents reference each other.** Cross-links replace duplication.
7. **Living documents.** Knowledge evolves. Update the canonical source when understanding changes.
8. **Remove, don't accumulate.** Delete obsolete knowledge. Do not leave it to rot.

---

## The Three Layers

```
Layer 1: IDENTITY (rarely changes)
  Who we are. Why we exist. What we stand for.
  Change frequency: years.

Layer 2: STRATEGY (changes quarterly)
  Where we're going. How we'll get there. What we won't do.
  Change frequency: months.

Layer 3: IMPLEMENTATION (changes continuously)
  How it works. What exists today. What to change.
  Change frequency: days to weeks.
```

Each layer has a distinct home. Information belongs to the layer that matches its change frequency.

---

## Document Map

### Layer 1: Identity

| Document | Primary Question | Location |
|----------|-----------------|----------|
| Foundations | Why does FixFlags deserve to exist? | `knowledge/foundations.md` |
| Soul | Who is the product, and how does it speak? | `SOUL.md` |
| Voice & Copy | How do we write? | `docs/voice-and-copy.md` |

**Rules:**
- Foundations contains the thesis, 25 principles, and research validation. Read this first.
- SOUL.md contains identity, personality, emotional experience, and voice summary.
- docs/voice-and-copy.md contains the full writing guidelines, vocabulary rules, and copy review checklist.
- Never duplicate principles across these files. Reference foundations.md.

---

### Layer 2: Strategy

| Document | Primary Question | Location |
|----------|-----------------|----------|
| Market | What is the market context? | `knowledge/market.md` |
| Product Vision | What system are we building and why? | `knowledge/vision.md` |
| Product Mechanics | How do the Contract, Flag, truth, and moat work? | `knowledge/product.md` |
| Product System | What are the three products and how do they work? | `knowledge/product-system.md` |
| User Journey | Who are the personas and how do they convert? | `knowledge/user-journey.md` |
| Pricing & Revenue | How do we make money? | `knowledge/strategy.md` |
| Growth | How do we acquire and retain customers? | `knowledge/growth.md` |
| Execution Plan | What do we build this quarter? | `knowledge/execution.md` |
| Roadmap | What is the repository-level direction? | `ROADMAP.md` |
| Decisions | What durable decisions have we made? | `DECISIONS.md` |

**Rules:**
- knowledge/market.md contains market context, competitors, segments, risks, distribution.
- knowledge/vision.md contains the north-star narrative and system layers.
- knowledge/product.md contains the moat, Product Contract, Flag system, truth system, and repair specification.
- knowledge/product-system.md contains Product Review, Deep Review, Watch, activation, paywall, and priority tiers.
- knowledge/user-journey.md contains personas, core user journey, conversion architecture, and required copy changes.
- knowledge/strategy.md contains pricing philosophy, tier structure, revenue model, unit economics.
- knowledge/growth.md contains growth engine, distribution strategy, defensibility, and metrics.
- knowledge/execution.md contains the six-month plan, weekly dashboard, what to build/defer.
- ROADMAP.md contains repository-level direction: Now / Next / Later / Not planned.
- DECISIONS.md contains durable decisions with rationale. Only product, soul, design, architecture, data, security, or quality decisions.

**Never duplicate:**
- Pricing tiers: only in knowledge/strategy.md
- Competitor analysis: only in knowledge/market.md
- Product vision: only in knowledge/vision.md
- Product mechanics: only in knowledge/product.md
- Three products: only in knowledge/product-system.md
- User personas and journey: only in knowledge/user-journey.md
- Growth strategy: only in knowledge/growth.md
- Execution milestones: only in knowledge/execution.md

---

### Layer 3: Implementation

| Document | Primary Question | Location |
|----------|-----------------|----------|
| Product Facts | What does FixFlags ship today? | `PRODUCT.md` |
| Architecture | How does the system work? | `ARCHITECTURE.md` |
| Technical Architecture Spec | What is the target technical architecture? | `knowledge/technical-architecture-spec.md` |
| Design Standards | What are the visual and interaction rules? | `DESIGN.md` |
| Development | How do I set up and run the project? | `DEVELOPMENT.md` |
| Security | What are the security invariants? | `SECURITY.md` |
| Quality | How do we verify correctness? | `QUALITY.md` |
| Audit Pipeline | How does the scan pipeline work? | `docs/audit-pipeline.md` |
| Report Contract | Which information belongs on the focused, detailed, progressive, sample, and share surfaces? | `knowledge/report-contract.md` |
| Evidence Rules | What are the evidence classes, severity levels, and Flag anatomy? | `knowledge/evidence-rules.md` |
| Launch Requirements | What are the launch readiness criteria and validation plan? | `knowledge/launch-requirements.md` |
| Code Map | Where do I find things in the codebase? | `CODEMAP.md` |
| Agent Operating System | How do AI agents work on this project? | `AGENTS.md` |

**Rules:**
- PRODUCT.md contains verified facts about what FixFlags ships today: users, capabilities, limitations, support. Not vision. Not strategy.
- ARCHITECTURE.md contains system architecture, data flows, modules. Documented as implemented, not aspirational.
- knowledge/technical-architecture-spec.md contains the target technical architecture: discovery, deterministic checker, goal runner, verification, judgment, fix compiler, re-check engine, change intelligence.
- DESIGN.md contains visual and interaction standards. Code-enforced where possible.
- DEVELOPMENT.md contains setup, commands, debugging, deployment. Verified procedures only.
- SECURITY.md contains assets, trust boundaries, invariants, dangerous operations.
- QUALITY.md contains verification matrix, risks, required checks, evidence.
- docs/audit-pipeline.md contains the canonical audit pipeline reference: stages, AI phases, degradation, recovery.
- knowledge/report-contract.md contains the canonical report hierarchy: information architecture, acceptance checks, progressive report, samples and sharing.
- knowledge/evidence-rules.md contains evidence classes (Confirmed/Observed/Suggested), severity levels (Blocker/High/Medium/Polish), Flag anatomy, Critical Flag policy, evaluation system, and measurement.
- knowledge/launch-requirements.md contains launch requirements, launch demo spec, validation plan, cost requirements, and safety/privacy protections.
- CODEMAP.md contains the repository atlas: entry points, directory map, where to change things.
- AGENTS.md contains the agent operating system: project facts, key directories, verified commands, critical invariants, git workflow, verification checklist.

**Never duplicate:**
- Audit pipeline stages: only in docs/audit-pipeline.md
- Check capabilities and module counts: generate with `npm run audit:capabilities`; do not store volatile counts in Markdown.
- Directory structure: only in CODEMAP.md
- Verified commands: only in AGENTS.md and DEVELOPMENT.md (AGENTS.md for agents, DEVELOPMENT.md for humans)
- Evidence classes and severity: only in knowledge/evidence-rules.md
- Launch requirements: only in knowledge/launch-requirements.md

---

## Cross-Reference Index

When you need information about a topic, go to the canonical source:

| Topic | Canonical Source |
|-------|------------------|
| Why FixFlags exists | `knowledge/foundations.md` |
| 12 foundational principles | `knowledge/foundations.md` |
| Brand identity | `SOUL.md` |
| Voice and tone | `docs/voice-and-copy.md` |
| Writing guidelines | `docs/voice-and-copy.md` |
| Market context | `knowledge/market.md` |
| Competitors | `knowledge/market.md` |
| Customer segments | `knowledge/market.md` |
| Product vision | `knowledge/vision.md` |
| Product Memory | `knowledge/vision.md` → Product Memory, `knowledge/product-intelligence.md` |
| Product Graph | `knowledge/vision.md` → Product Graph |
| Product moat | `knowledge/product.md` |
| Product Contract | `knowledge/product.md` |
| Flag system | `knowledge/product.md` |
| Truth system | `knowledge/product.md` |
| Three products | `knowledge/product-system.md` |
| Product Review, Deep Review, Watch | `knowledge/product-system.md` |
| Activation and paywall | `knowledge/product-system.md` |
| User personas | `knowledge/user-journey.md` |
| Core user journey | `knowledge/user-journey.md` |
| Conversion architecture | `knowledge/user-journey.md` |
| Required copy changes | `knowledge/user-journey.md` |
| Pricing philosophy | `knowledge/strategy.md` |
| Pricing tiers | `knowledge/strategy.md` |
| Revenue model | `knowledge/strategy.md` |
| Growth engine | `knowledge/growth.md` |
| Distribution strategy | `knowledge/growth.md` |
| Defensibility | `knowledge/growth.md` |
| Execution plan | `knowledge/execution.md` |
| What to build this quarter | `knowledge/execution.md` |
| What not to build | `knowledge/execution.md` |
| Repository direction | `ROADMAP.md` |
| Durable decisions | `DECISIONS.md` |
| What FixFlags ships today | `PRODUCT.md` |
| Current capabilities | `PRODUCT.md` |
| Limitations and debt | `PRODUCT.md` |
| System architecture | `ARCHITECTURE.md` |
| Target technical architecture | `knowledge/technical-architecture-spec.md` |
| Data flows | `ARCHITECTURE.md` |
| Design standards | `DESIGN.md` |
| Visual rules | `DESIGN.md` |
| Setup and commands | `DEVELOPMENT.md` |
| Debugging | `DEVELOPMENT.md` |
| Deployment | `DEVELOPMENT.md` |
| Security invariants | `SECURITY.md` |
| Trust boundaries | `SECURITY.md` |
| Verification matrix | `QUALITY.md` |
| Audit pipeline | `docs/audit-pipeline.md` |
| Report hierarchy | `knowledge/report-contract.md` |
| Evidence classes | `knowledge/evidence-rules.md` |
| Severity levels | `knowledge/evidence-rules.md` |
| Flag anatomy | `knowledge/evidence-rules.md` |
| Critical Flag policy | `knowledge/evidence-rules.md` |
| Evaluation system | `knowledge/evidence-rules.md` |
| Launch requirements | `knowledge/launch-requirements.md` |
| Validation plan | `knowledge/launch-requirements.md` |
| Cost requirements | `knowledge/launch-requirements.md` |
| Safety and privacy | `knowledge/launch-requirements.md` |
| Pipeline stages | `docs/audit-pipeline.md` |
| AI phases (triage/prescription) | `docs/audit-pipeline.md` |
| Degradation and recovery | `docs/audit-pipeline.md` |
| Where to find code | `CODEMAP.md` |
| Repository atlas | `CODEMAP.md` |
| Agent operating system | `AGENTS.md` |
| Agent invariants | `AGENTS.md` |
| Git workflow | `AGENTS.md` |
| Verification checklist | `AGENTS.md` |

---

## Evolution Rules

### When to Update a Document

1. **Before implementing anything, check if the knowledge should change.** If understanding has changed, update the canonical source first.
2. **After implementation, reconcile new knowledge.** If implementation revealed something, update the canonical source.
3. **When in doubt, update the most stable layer.** Principles change less often than strategy. Strategy changes less often than implementation.

### How to Update

1. **Find the canonical source.** Use the cross-reference index above.
2. **Update in place.** Do not create a new document. Do not copy content to another document.
3. **Add cross-references if needed.** If another document references this topic, add a link to the canonical source.
4. **Remove obsolete knowledge.** Delete outdated information. Do not leave it to rot.
5. **Update the cross-reference index.** If you created a new canonical source, add it to the index.

### What Never Changes

- The 12 foundational principles (unless the thesis itself changes)
- The brand name (FixFlags)
- The customer loop (Check → Fix → Verify → Watch) and the canonical improvement loop (Signal → Understand → Prioritize → Fix → Verify → Learn)
- The three rubrics (Message, Experience, Reach)

### What Changes Rarely

- Product vision
- Pricing philosophy
- Market positioning
- Architecture decisions

### What Changes Frequently

- Volatile project facts are generated from code with `npm run agent`, `npm run audit:capabilities`, and the relevant test command.
- Current capabilities
- Roadmap status (Now / Next / Later)
- Implementation details

---

## Reading Order

### For AI Agents

1. `AGENTS.md` (start here for operational context)
2. `knowledge/foundations.md` (understand the thesis)
3. `CODEMAP.md` (understand the codebase)
4. Topic-specific document from the cross-reference index

### For Humans

1. `knowledge/foundations.md` (understand the thesis)
2. `SOUL.md` (understand the identity)
3. `knowledge/product.md` (understand the product)
4. `knowledge/product-system.md` (understand the three products)
5. `knowledge/strategy.md` (understand the business)
6. `knowledge/execution.md` (understand the plan)
7. Topic-specific document from the cross-reference index

### For New Contributors

1. `README.md` (quick start)
2. `DEVELOPMENT.md` (setup and commands)
3. `knowledge/foundations.md` (understand the thesis)
4. `CODEMAP.md` (understand the codebase)
5. Topic-specific document from the cross-reference index

---

## Anti-Patterns

**Never do these:**

1. **Duplicate knowledge.** If pricing appears in two files, one is wrong.
2. **Mix stable and evolving knowledge.** Principles do not belong in the same file as check counts.
3. **Create new documents for existing topics.** Use the canonical source.
4. **Leave obsolete knowledge.** Delete it.
5. **Reference non-canonical sources.** Always link to the canonical source.
6. **Overload a document.** If a document answers multiple unrelated questions, split it.
7. **Hardcode facts that change.** Generate volatile facts from code and repository commands.

---

## Verification

Before claiming a knowledge update is complete:

- [ ] The canonical source is updated
- [ ] Cross-references are added if needed
- [ ] Obsolete knowledge is removed
- [ ] The cross-reference index is updated if needed
- [ ] No duplication exists (search for the topic across all documents)

---

## Summary

The knowledge architecture has three layers:

1. **Identity** (rarely changes): foundations, soul, voice
2. **Strategy** (changes quarterly): market, product, product system, user journey, pricing, growth, execution, roadmap, decisions
3. **Implementation** (changes continuously): product facts, architecture, technical architecture spec, design, development, security, quality, audit pipeline, report contract, evidence rules, launch requirements, code map, agent system

Every concept has one canonical source. Documents reference each other. Knowledge evolves. Obsolete knowledge is removed.

This is the operating system of the project.

## AI operating model

The AI-native operating model for agents and team execution is canonical in `.agents/company/`; start at `.agents/company/README.md`.
Related docs:
- `.agents/company/ceo.md` — CEO loop, routing, rhythm, release gates, experiment outcomes, scorecard, escalation
- `.agents/company/executives.md` — executive ownership, objective cadence, paid-model approvals
- `.agents/company/worker-runtime.md` — worker task contract fields

Do not duplicate operating policy here; reference the canonical files.

