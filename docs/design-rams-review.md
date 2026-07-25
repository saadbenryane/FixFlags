# Good Design, Reviewed: Dieter Rams' Ten Principles Applied to FixFlags

*A standing design review of FixFlags against Dieter Rams' ten principles of good design. Reference tier: `DESIGN.md` remains the constitution; this doc is the audit of how well we live up to it, and the rules we adopted as a result. Last full pass: 2026-07.*

FixFlags sells design judgment. The product audits AI-built sites for the exact failures Rams warned about: noise, dishonesty, arbitrariness, decoration without purpose. That makes this review load-bearing: the product must survive its own audit.

Canonical principle text: Vitsœ, [vitsoe.com/us/about/good-design](https://www.vitsoe.com/us/about/good-design). Rams formulated the principles at Braun in the late 1970s as an answer to "an impenetrable confusion of forms, colours and noises."

## How the ten principles map to our five

`DESIGN.md` states five principles. They are a compression of Rams, not a departure:

| DESIGN.md principle | Rams principles it carries |
|---------------------|---------------------------|
| Editorial + technical credibility | 3 (aesthetic), 6 (honest) |
| Calm authority | 5 (unobtrusive), 9 (no visual pollution) |
| Physical, not flat | 3 (aesthetic), 8 (thorough) |
| Contained, not sprawling | 10 (as little design as possible), 2 (useful) |
| Recognizable, not generic | 7 (long-lasting), 1 (innovative) |

The gap this review found is not in the principles. It is in principle 8: execution details that drifted from the stated system.

## The ten principles, applied

### 1. Good design is innovative

> "Innovative design always develops in tandem with innovative technology, and can never be an end in itself."

**For FixFlags:** the innovation is the loop, not the chrome. Flag → Fix → Re-check, with paste-ready fix prompts as the unit of value, is what technology newly makes possible. Visual novelty is not innovation; a new backdrop treatment adds nothing a user can act on.

**Assessment:** sound. The loop is protected by `PRODUCT.md` ("Every feature must serve the core loop") and `DECISIONS.md` (re-checks never gated). One correction shipped with this review: `_VBRANDING/` reference boards predate the current system (Canela/Inter type, five categories) and are now marked as mood reference only, so visual "innovation" is never re-imported from stale direction.

### 2. Good design makes a product useful

> "Good design emphasizes the usefulness of a product whilst disregarding anything that could possibly detract from it."

**For FixFlags:** usefulness is measured at the fix prompt. A flag the user cannot act on is decoration. Rams includes psychological criteria in usefulness: the ~60s audit wait and the report's first screen carry most of the product's perceived value.

**Assessment:** the report page is structured around action (Top Priorities with compact fix prompts, then the explorer). Report altitude is deliberate: hero identity (`ScoreDot`), explorer working score (`sm` ring), sticky hostname when stuck — not three competing score dashboards. Share status and status callouts each appear once. The weakest usefulness surfaces were the least-tested ones: empty, error, and progress states (`ROADMAP.md` had Touch-tier coverage at ~10%). This review added component tests for all of them so they cannot silently regress.

### 3. Good design is aesthetic

> "Only well-executed objects can be beautiful."

**For FixFlags:** the aesthetic is already chosen and documented (white canvas, ink, one orange signal, Inter Tight/Inter/JetBrains Mono). Beauty here is execution: identical things rendering identically everywhere.

**Assessment:** strong foundation (zero raw hex in components, tokenized shadows and radii, re-authored dark mode). The drift was micro-typography: dozens of inline `text-[10px]`/`text-[11px]` where `.meta-label`/`.section-label` or a token should be. Fixed in this pass: `--text-2xs`/`--text-3xs` tokens added, usages routed through them, and `ui:drift-guard` now fails on new arbitrary micro sizes.

### 4. Good design makes a product understandable

> "It clarifies the product's structure. At best, it is self-explanatory."

**For FixFlags:** a report must be readable by someone who has never seen one. The fixed vocabulary does most of this work: Flags, Rubrics, Re-check, Pass / Needs Attention / Blocked. The visual system must keep that vocabulary consistent: the same meaning must never appear in two different shapes.

**Assessment:** the status-component family is healthy, not sprawling. It has four deliberate altitudes, now codified as a rule (see "The four altitudes" below). The one real duplication (ad-hoc pill buttons in the report explorer re-implementing `FilterPill`) was removed by extending the primitive.

### 5. Good design is unobtrusive

> "Products fulfilling a purpose are like tools. Their design should be neutral and restrained, to leave room for the user's self-expression."

**For FixFlags:** the user's product is the protagonist; the report is the frame around their screenshots and their fixes. Inside the app, nothing should move unless it communicates state.

**Assessment:** mostly true, with one real bug: anonymous report viewers received the full animated marketing backdrop because the shell chose its variant by session presence. Fixed: report surfaces now always use the static backdrop. The ambient marketing loops themselves are retained deliberately (see motion policy below).

### 6. Good design is honest

> "It does not attempt to manipulate the consumer with promises that cannot be kept."

**For FixFlags:** honesty is structural product design, not tone. Re-checks are never gated (the loop is not a ransom). The banned-phrase list in `AGENTS.md` bans the vocabulary of overpromising. The progress UI advances only with real pipeline stages and streams real partial flags; it never fakes progress.

**Assessment:** the strongest principle in the product. Standing rule: upgrade moments (`lib/billing/upgrade-moments.ts`, `ContextualUpgradeCard`) may state what a plan adds, never degrade or threaten what the user already has. Any future countdown, scarcity, or pre-checked-consent pattern fails this review by definition. Progress UI: same chrome as the completed report; stages + partial flags only; never blank the COMPLETED handoff.

### 7. Good design is long-lasting

> "It avoids being fashionable and therefore never appears antiquated."

**For FixFlags:** we separate the durable core from replaceable treatments, so a future refresh swaps surface without churning identity.

- **Durable core (do not churn):** white canvas, near-black ink, one orange signal at ~10%, Inter Tight display + mono labels, ~10px control radius, the three-rubric structure, the naming system.
- **Replaceable treatments (fashion-adjacent, may be swapped):** glass blur, ambient peach orbs, gradient CTA treatment.

**Assessment:** glassmorphism is the system's riskiest fashion bet. That is acceptable while it stays a treatment: it lives entirely in tokens and utility classes (`glass-*`, `--glass-shadow`), so retiring it is a token change, not a rewrite.

### 8. Good design is thorough down to the last detail

> "Nothing must be arbitrary or left to chance. Care and accuracy in the design process show respect towards the user."

**For FixFlags:** this was the review's main workstream. Arbitrariness found and removed in this pass:

- Micro font sizes inlined instead of tokenized (principle 3 above).
- Raw `<button>` elements bypassing the `Button` primitive, several without focus rings, one without `type="button"` inside form-adjacent UI.
- Dead design code: an unused badge component and five animation definitions that no component referenced.
- The `--text-*` type scale existed in `tokens.css` but was never wired into Tailwind, so `DESIGN.md`'s type table was not true at runtime.
- `app/demo/demo.css` looked like drift but is intentional: it styles the fictional audited product, not FixFlags (now stated in its header comment).

**Assessment:** each item above is fixed or explicitly ruled intentional. The guards (`ui:drift-guard`, `brand:hex-guard`) are the enforcement arm of this principle: arbitrariness should fail CI, not wait for a review.

### 9. Good design is environmentally friendly

> "It conserves resources and minimizes physical and visual pollution throughout the lifecycle of the product."

**For software:** resources are cycles, bytes, and attention. Infinite GPU-composited animation on idle pages burns battery for nothing; visual pollution is the same principle applied to attention.

**Assessment:** ambient loops are now confined to marketing landing surfaces and are `motion-safe:` gated on top of the global `prefers-reduced-motion` kill switch. App, report, dashboard, and admin surfaces idle at zero animation. Screenshots ship as WebP. Report payload stays lean by rendering evidence from stored captures rather than live embeds.

### 10. Good design is as little design as possible

> "Less, but better. Concentrated on the essential aspects, not burdened with non-essentials."

**For FixFlags:** containment is already the product thesis (three rubrics, one core loop). At the component level the rule is: **reuse a primitive before inventing one.** A new component must name the existing primitive it extends or the altitude gap it fills.

**Assessment:** 34 primitives serving 180+ components is a healthy ratio. This review deleted rather than added: dead code out, ad-hoc duplicates folded into primitives, and no new visual concepts introduced.

## Rules adopted by this review

### Motion policy

Ambient motion (peach orb drift/breathe, gradient shift) is a **marketing-landing brand signature only**.

- Allowed: marketing landing surfaces, `motion-safe:` gated, respecting the global reduced-motion block.
- Never: app, report, dashboard, admin, or any surface a signed-in or anonymous user works in. These idle at zero running animations.
- Interaction feedback everywhere follows `DESIGN.md` Motion (200ms base, specific properties, no `transition: all`).

Mechanism: `SiteShell` exposes a `backdrop` prop; report shells pass `backdrop="minimal"` regardless of session state.

### The four altitudes (status components)

Status UI has exactly four altitudes. Use the one matching the blast radius; do not invent a fifth:

| Altitude | Component | Use |
|----------|-----------|-----|
| Inline token | `ui/badge.tsx` (+ thin wrappers `SeverityBadge`, `RubricStatusBadge`) | A word-sized state marker inside content |
| Block message | `ui/callout.tsx` | A paragraph-sized notice inside a page section |
| Page section | `ui/empty-state.tsx` | A region with nothing to show yet, plus the next action |
| Full page | `ui/status-page.tsx` | The whole route is in a terminal state |

Wrappers that add domain vocabulary on top of these are correct; parallel implementations are not.

### Durable core vs. replaceable treatment

Changes to the durable core (canvas, ink, signal orange, type stack, rubric structure, naming) require a `DECISIONS.md` entry. Treatments (glass, orbs, gradients) may evolve without one, provided they stay token-routed.

## Backlog and status

| Item | Principle | Status |
|------|-----------|--------|
| Rams review doc + stale-reference notes | 1, 7 | Done (this doc) |
| Delete dead design code (GradeBadge, unused keyframes) | 8, 10 | Done |
| Micro-typography tokens + drift guard rule | 3, 8 | Done |
| Raw `<button>` conversion/hardening | 8 | Done |
| `FilterPill` size + `aria-pressed`; `LighthouseNote` rename | 4, 10 | Done |
| Backdrop policy + anonymous-viewer fix | 5, 9 | Done |
| Empty/error/progress state component tests | 2, 8 | Done |
| Wire full `--text-*` scale into Tailwind `fontSize` | 8 | Done (visual reflow reviewed) |
| Periodic re-review: dark-pattern audit of new upgrade moments | 6 | Standing |
| Periodic re-review: payload budget on report route | 9 | Standing |
