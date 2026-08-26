# Knowledge Evolution Rules

This document defines when, how, and why the project knowledge changes.

The knowledge system is a living system. It evolves as the product evolves. These rules ensure it evolves coherently.

---

## The Evolution Loop

Every task follows this loop:

1. **Before implementing**, check if the knowledge should change.
2. **If understanding changed**, update the canonical source first.
3. **Then implement** the feature or fix.
4. **After implementation**, reconcile new knowledge back into the canonical source.
5. **Never allow** documentation and implementation to drift apart.
6. **Remove obsolete knowledge** rather than accumulating it.
7. **Keep the project understanding coherent** across all documents.

---

## When to Update

### Before Implementation

Ask: "Does this task change what we know about the product?"

- If yes, update the canonical source before writing code.
- If no, proceed with implementation.

Examples:
- Adding a new check module? Update PRODUCT.md (capabilities) and register it in `lib/audit/checks/index.ts`. Do not store check counts in AGENTS.md.
- Changing pricing? Update knowledge/strategy.md (pricing tiers).
- Fixing a bug that reveals a design principle? Update DECISIONS.md.
- Refactoring architecture? Update ARCHITECTURE.md.
- Changing the north-star narrative or system layers? Update knowledge/vision.md.
- Changing Product Contract, Flag, truth, or moat mechanics? Update knowledge/product.md.

### During Implementation

Ask: "Did I learn something new that changes the canonical understanding?"

- If yes, update the canonical source immediately.
- If no, continue implementation.

Examples:
- Discovered a new invariant? Add it to AGENTS.md.
- Found a better way to express a principle? Update knowledge/foundations.md.
- Realized two concepts were conflated? Split them in the canonical sources.

### After Implementation

Ask: "Does the implementation reveal knowledge that should be documented?"

- If yes, update the canonical source.
- If no, proceed to verification.

Examples:
- Shipped a feature that changes the product loop? Update PRODUCT.md.
- Discovered a new edge case? Update QUALITY.md.
- Learned a lesson about the architecture? Update ARCHITECTURE.md.

---

## How to Update

### Step 1: Find the Canonical Source

Use `CANONICAL-SOURCES.md` to find the one canonical source for the concept.

If the concept is not in the index:
1. Determine which layer it belongs to (identity, strategy, or implementation).
2. Find the most appropriate canonical source for that layer.
3. Add the concept to the canonical source.
4. Add the concept to `CANONICAL-SOURCES.md`.

### Step 2: Update in Place

**Never create a new document for existing knowledge.**

- Edit the canonical source directly.
- Preserve the document's structure and style.
- Add cross-references if needed.

### Step 3: Remove Duplicates

If you find the same information in multiple places:

1. Identify the canonical source using `CANONICAL-SOURCES.md`.
2. Keep the canonical source as the authoritative version.
3. Replace duplicates with a reference: "See [canonical source] for details."
4. Update `CANONICAL-SOURCES.md` if the canonical source is unclear.

### Step 4: Remove Obsolete Knowledge

**Delete outdated information. Do not leave it to rot.**

- If a feature is removed, remove it from PRODUCT.md.
- If a decision is superseded, mark it as superseded in DECISIONS.md.
- If a principle no longer applies, remove it from knowledge/foundations.md.

### Step 5: Update Cross-References

If you created a new canonical source or moved information:

1. Update `CANONICAL-SOURCES.md` with the new entry.
2. Update any documents that referenced the old location.
3. Update `knowledge/README.md` if the architecture changed.

---

## What Changes Rarely

These concepts change infrequently (years or never):

- **The 25 foundational principles** (knowledge/foundations.md)
- **The brand name** (FixFlags)
- **The customer loop** (Product Review → Fix → Verify → Watch) and **the canonical improvement loop** (Observe → Understand → Judge → Improve → Verify → Learn)
- **The three rubrics** (Message, Experience, Reach)
- **The product vision** (knowledge/vision.md)
- **The pricing philosophy** (knowledge/strategy.md → Pricing Philosophy)

When these change, it is a major event. Document the change in DECISIONS.md.

---

## What Changes Quarterly

These concepts change every few months:

- **Market context** (knowledge/market.md)
- **Competitive landscape** (knowledge/market.md)
- **Customer segments** (knowledge/market.md)
- **Pricing tiers** (knowledge/strategy.md)
- **Revenue model** (knowledge/strategy.md)
- **Execution plan** (knowledge/execution.md)
- **Roadmap status** (ROADMAP.md → Now / Next / Later)

When these change, update the canonical source and review related documents for consistency.

---

## What Changes Frequently

These concepts change every week or month:

- **Current capabilities** (PRODUCT.md → Current capabilities)
- **Limitations and technical debt** (PRODUCT.md → Limitations and technical debt)
- **Directory structure** (ARCHITECTURE.md → Directory structure)
- **Recently closed items** (ROADMAP.md → Recently closed)

When these change, update the canonical source. Do not hardcode check, model, or test counts in AGENTS.md.

---

## What Never Changes

Some knowledge is permanent:

- **The thesis** (knowledge/foundations.md → The Thesis)
- **The 25 foundational principles** (unless the thesis itself changes)
- **The brand name** (FixFlags)
- **The customer loop** (Product Review → Fix → Verify → Watch) and **the canonical improvement loop** (Observe → Understand → Judge → Improve → Verify → Learn)
- **The three rubrics** (Message, Experience, Reach)
- **The independence principle** (knowledge/foundations.md → Independence)

If these change, the product itself has changed. Document the change in DECISIONS.md and update all references.

---

## Anti-Patterns

**Never do these:**

1. **Duplicate knowledge across documents.** If pricing appears in two files, one is wrong.
2. **Mix stable and evolving knowledge.** Principles do not belong in the same file as check counts.
3. **Create new documents for existing topics.** Use the canonical source.
4. **Leave obsolete knowledge.** Delete it.
5. **Reference non-canonical sources.** Always link to the canonical source.
6. **Overload a document.** If a document answers multiple unrelated questions, split it.
7. **Hardcode facts that change.** Prefer generated capability reports and PRODUCT.md over counts in AGENTS.md.
8. **Update a copy instead of the canonical source.** Always find the canonical source first.
9. **Leave knowledge unlinked.** Every concept should be in CANONICAL-SOURCES.md.
10. **Ignore the evolution loop.** Always check if knowledge should change before implementing.

---

## Verification Checklist

Before claiming a knowledge update is complete:

- [ ] The canonical source is updated
- [ ] Cross-references are added if needed
- [ ] Obsolete knowledge is removed
- [ ] The canonical sources index is updated if needed
- [ ] No duplication exists (search for the topic across all documents)
- [ ] The change is consistent with the layer it belongs to (identity, strategy, or implementation)

---

## Examples

### Example 1: Adding a New Check Module

**Before implementation:**
- Check PRODUCT.md → Current capabilities
- Check `lib/audit/checks/index.ts` for the live registry

**During implementation:**
- Add the check module to lib/audit/checks/
- Register it in checks/index.ts barrel
- Add check IDs to check-ids.ts

**After implementation:**
- Update PRODUCT.md → Current capabilities
- Update docs/scan-catalog.md (if it exists)
- Run `npm run audit:capabilities` to verify

### Example 2: Changing Pricing

**Before implementation:**
- Check knowledge/strategy.md → Pricing (Current)
- Check knowledge/strategy.md → Pricing Philosophy

**During implementation:**
- Update lib/billing/plans.ts
- Update Stripe price IDs
- Update billing logic

**After implementation:**
- Update knowledge/strategy.md → Pricing (Current)
- Update knowledge/strategy.md → Tier Pricing (Proposed Evolution) if applicable
- Update PRODUCT.md → Pro / Studio / High Volume
- Update DECISIONS.md with the pricing decision and rationale
- Update CANONICAL-SOURCES.md if the canonical source changed

### Example 3: Fixing a Bug That Reveals a Design Principle

**Before implementation:**
- Check DECISIONS.md for similar decisions
- Check AGENTS.md → Critical invariants

**During implementation:**
- Fix the bug
- Add a regression test

**After implementation:**
- If the fix reveals a new invariant, add it to AGENTS.md → Critical invariants
- If the fix reveals a durable decision, add it to DECISIONS.md
- Update QUALITY.md if the fix changes the verification matrix

---

## Summary

The knowledge system evolves as the product evolves. Follow the evolution loop:

1. Check if knowledge should change before implementing.
2. Update the canonical source first.
3. Implement the feature.
4. Reconcile new knowledge back into the canonical source.
5. Never allow documentation and implementation to drift.
6. Remove obsolete knowledge.
7. Keep the project understanding coherent.

Use `CANONICAL-SOURCES.md` to find the one canonical source for every concept. Use `knowledge/README.md` to understand the architecture.

This is how the repository becomes the persistent memory of the product.
