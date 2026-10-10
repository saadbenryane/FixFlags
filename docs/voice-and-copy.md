---
status: canonical
authority: interface
reviewed_at: 2026-10-10
supersedes: []
---

# FixFlags voice and language

This document defines durable language principles and vocabulary. It is not a library of page copy or an implementation brief.

Exact rendered strings live in `lib/marketing/copy/` and their tests. Product direction lives in [knowledge/vision.md](../knowledge/vision.md), personality in [SOUL.md](../SOUL.md), and certainty rules in [knowledge/evidence-rules.md](../knowledge/evidence-rules.md). Historical reviews and handoffs do not override those sources.

## Audience and position

FixFlags is for people responsible for live websites and software. They may be developers, founders, ecommerce operators, growth teams, or agencies. Write for technically literate readers without forcing implementation detail into every surface.

FixFlags independently observes important live behavior, raises meaningful Flags, supports a fix, and verifies the result with fresh evidence. It reduces uncertainty; it does not promise omniscience, guaranteed revenue, or prevention of every failure.

## Voice

Use language that is:

- concise, calm, precise, and credible;
- concrete about the observed behavior and affected scope;
- benefit-led, with technical evidence available through progressive depth;
- direct when evidence supports words such as broken, unavailable, or failing;
- quiet when nothing requires attention.

Avoid:

- vague SaaS filler and consultant language;
- repeated explanations or taxonomy;
- patronizing reassurance and fear-based urgency;
- invented measurements, testimonials, savings, causality, or coverage;
- claims about planned or locally implemented behavior as though it is released;
- em dashes in newly authored customer copy.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Site | The customer-owned live product FixFlags observes. |
| Outcome | An important result the Site must deliver. |
| Journey | A browser path used to exercise a human-facing Outcome. |
| Flag | A problem important enough to warrant action. |
| Recommendation | A possible improvement that does not currently warrant a Flag. |
| Clear | Current evidence supports the expected result for the stated scope. |
| Couldn't verify | FixFlags could not obtain sufficient evidence. It is not Clear and is not a customer failure. |
| Fix | The change made by the customer, team, agency, or coding tool. |
| Verify | A fresh, comparable FixFlags evaluation after a change. |
| Monitoring | Scheduled independent execution. |
| Coverage | What was evaluated, when, and with what limits. |
| Check | A technical evidence producer, usually internal rather than a customer object. |

Prefer the concrete Outcome or result over abstract internal nouns. Do not create parallel customer taxonomies such as monitors, objectives, tasks, issues, warnings, alerts, and checks when the existing objects communicate the state.

Internal identifiers may retain legacy names where changing them would be unsafe. Internal vocabulary does not automatically become interface copy.

## Evidence and state

- A live server does not prove an important journey works.
- No open Flag does not make untested, stale, or blocked behavior Clear.
- Every health statement identifies relevant scope and freshness nearby.
- A deployment, copied prompt, or coding-agent claim is context, not verification.
- Recovery requires fresh comparable evidence. Disappearing evidence becomes Couldn't verify, not resolved.
- Illustrative or fixture evidence is labeled and never presented as customer history.
- Integration context may improve understanding but does not independently make an Outcome Clear.

Describe partial success precisely. Preserve distinctions between saved configuration, queued work, completed execution, a passing result, a Flag, stale evidence, and unavailable evidence.

## Actions and responsibility

Use action labels that state what will happen. Do not imply that viewing guidance performs a fix or that requesting a run has already produced a result.

FixFlags observes, explains, and verifies. The customer or their chosen tool normally changes the software. External messages, repository edits, deployments, purchases, and other consequential actions require the customer's authorization.

MCP and coding-tool integration are interaction channels, not the product hierarchy. Lead with the customer result; expose setup terminology where the reader needs it.

## Monitoring and notifications

Monitoring copy states the actual scope, cadence, last result, next scheduled execution, and material setup limitations. Do not imply instant detection, continuous coverage, an SLA, or broader recurring execution than the product provides.

Notifications interrupt only for meaningful changes, recovery, lost promised coverage, or required customer action. Routine successful executions should remain quiet unless the customer asks for them.

## Privacy

State privacy behavior plainly and in the appropriate surface. Do not turn privacy into a promotional manifesto. Never expose customer data, prompts, credentials, private evidence, or provider configuration in customer copy.

## Sentence rules

Use familiar words, concrete behavior, and active sentences. Lead with the human effect and let the interface reveal technical evidence through depth. Short copy must still communicate uncertainty and scope.

Before adding or changing customer copy:

1. Confirm the behavior is released or label its state accurately.
2. Use the established vocabulary.
3. Tighten any claim that needs a disclaimer to become true.
4. Put the exact string in the relevant `lib/marketing/copy/` module.
5. Add or update a behavior-oriented test when the wording carries a product contract.

Do not copy example headlines, CTAs, card contents, or page sequences into this document. The implemented surface and its tests are the authority for exact current wording.
