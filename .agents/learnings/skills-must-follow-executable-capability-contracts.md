# Skills must follow executable capability contracts

Date: 2026-10-06
Scope: agent guidance and public capability parity
Confidence: high

## Discovery

The marketing skill froze an older list of watchable Outcomes. Safe Signup had
since joined the executable contract with a reversible fixture boundary, but
the skill still told agents that Signup was unavailable.

## Rule

When a customer capability has an authoritative executable contract, skills
should point to that contract first. If a current list is useful, state its
safety boundary and update it in the same change that updates the contract.
Do not let agent guidance become a second capability registry.

## Prevention encoded

The FixFlags marketing skill now treats `watchableOutcomeKinds()` as
authoritative, describes the Safe Signup boundary, and keeps Login and Password
reset explicitly unavailable. Its existing claim-parity test requirement
remains coupled to future contract changes.

