# Homepage Outcome claim truth

**Status:** Locally implemented and fully verified. **Owner:** `codex-root`. **Branch:** `main`. **Date:** 2026-10-01.

## Customer outcome

A prospective customer can tell what FixFlags can independently verify today without mistaking protected Signup, Login, Password reset, form or generic core-action examples for shipped monitoring.

## Delivered

- Replaced the broad hero promise with the two concrete executable boundaries: public page availability and Checkout.
- Reframed the coverage section around what FixFlags can verify today while retaining broader Site analysis as supporting evidence.
- Removed unsupported form, Signup, Login and generic core-action items from the audience tabs.
- Added a visible Web app boundary: protected account flows are not monitored yet and need a safe approved test-access contract.
- Corrected the homepage integration statement so GitHub is sign-in and Flag handoff, not a context connection.
- Added a regression that requires public Outcome claim presence to match `watchableOutcomeKinds()`.
- Updated the marketing skill and recorded the durable learning in `.agents/learnings/public-outcome-claims-follow-executable-kinds.md`.

## Evidence

- Red before green: the new contract test failed on the existing Signup claim, then passed after the repair.
- `npx vitest run components/marketing/homepage/__tests__/CareHomepage.test.tsx`: 17/17 passed.
- Scoped ESLint passed with zero warnings.
- Nonincremental TypeScript passed.
- `copy-drift-check`, `ui:drift-guard`, `product:contract-guard`, `completeness:audit`, `skills:validate`, and `git diff --check` passed. Two initially mistyped script names ran no corresponding check and were immediately replaced by the correct commands; they are not counted as evidence.
- Real local Next homepage: at 375×812 and 1280×900, selecting Web app displayed the boundary, retained keyboard-oriented tabs, had `scrollWidth === innerWidth`, and logged no browser warnings or errors.
- The first full repository verification reached `test:unit` and exposed one exact-copy contract: integration copy must retain “They do not decide whether an Outcome is Clear.” The sentence was restored for the three context connections while GitHub remains a separate sign-in and Flag-handoff statement. The failed run is not counted as a green receipt.
- Final `npm run agent -- verify`: all 30 selected commands passed, including database validation/drift, nonincremental TypeScript, lint, full unit and script suites, coverage, accuracy evaluation, optimized Next build, worker build and container build. Receipt: `.agent-runs/2026-10-01T10-19-03-888Z-container-build.log`.

## Limits

This is local implementation evidence, not a production release or customer validation. The existing exact-SHA canary, external-client and paid-checkout gates remain open. The unrelated JEV working-tree changes were preserved.
