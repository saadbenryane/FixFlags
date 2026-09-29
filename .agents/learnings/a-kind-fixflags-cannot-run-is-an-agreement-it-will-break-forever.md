# A kind FixFlags cannot run is an agreement it will break forever

Discovery: 2026-09-29, from `.agents/learnings/the-outcome-loop-has-never-been-entered.md`, which asked the owner to choose between widening what FixFlags can verify and keeping inference internal.

## The defect, proven by execution rather than by reading

`bindingForConfirmedKind('SIGNUP', siteUrl)` in `lib/sites/outcomes.ts` writes:

```
{ key: 'signup-form-v1', mechanism: 'SAFE_FORM', config: { startUrl, safety: 'protected' } }
```

`validateBindingConfig('SAFE_FORM', config)` against `safeFormBindingConfigSchema` requires `safety: 'reversible'`, `authorized: true` and a non-empty `fixtureId`, so it returns `binding_configuration_invalid`. CHECKOUT and AVAILABILITY validate.

So `CONFIRM_OUTCOME` with `kind: 'SIGNUP'` produced this chain, each step verified by running it:

1. `confirmedAt` is written and `inferenceSource` becomes `user`. The customer has an agreement on record.
2. `kind` becomes `SIGNUP`, so the Outcome stops being `GENERIC` and appears on Home. `bindings.some(required)` is true, so Verify is enabled.
3. Every run calls `runBoundOutcomeExecutions`, the binding fails validation, and the attempt is recorded `BLOCKED / binding_configuration_invalid`.
4. The Outcome reads "Couldn’t verify" on Home, forever, with no customer action that changes it. FixFlags would have claimed a promise it structurally cannot keep.

That is the same failure as confirming with no kind, which `94cf309d` refused, one step further along. A kind is necessary and not sufficient.

## The refusal is derived, not hardcoded

The tempting fix is `if (kind === 'SIGNUP') return refuse`. That is a second hand-written list of kinds next to `CONFIRMABLE_OUTCOME_KINDS`, and the defect class here is exactly a disagreement between two modules. So `outcomeKindWatchable(kind, siteUrl)` in `lib/sites/outcomes.ts` asks the run path's own question:

```ts
const binding = bindingForConfirmedKind(kind, siteUrl)
return validateBindingConfig(binding.mechanism, binding.config).success
```

The confirmation command and the execution path now read the same contract. Adding a fixture path that makes the signup config validate flips the refusal off on its own, and a fourth kind is held to the same invariant without anyone remembering to add it to a list.

The refusal message names the missing prerequisite (an approved test account and a way to undo the signup) and the two things FixFlags can watch instead, because a refusal that only says no is a dead end with better typography.

## Why a signup cannot simply be made to work

`safeFormBindingConfigSchema` is not aspirational. It demands `authorized: true` and a `fixtureId`, and `OutcomeFixture` has exactly one reference in the entire application, which is a read. No shipped path creates a fixture, so any `fixtureId` written here would point at nothing. Producing a valid-looking config by inventing a fixture id would convert a loud refusal into a silent BLOCKED, which is worse.

## The real path, walked

Local production build, signed in through the actual `POST /api/auth/sign-in/email`:

- `POST /api/sites/:id/outcomes` with `kind: 'SIGNUP'` → **400** `OUTCOME_KIND_UNWATCHABLE` and the reason in `message`.
- With no `kind` → **400** `OUTCOME_KIND_REQUIRED`.
- An Outcome id belonging to a different Site → **404**, so the refusal did not become a tenant-isolation hole.
- `kind: 'AVAILABILITY'` on the inferred `first-visit` Outcome → **200**, and the Outcome became `Watched Outcome` on Home with coverage "Production · page availability", state "Couldn’t verify" and an **enabled** Verify.
- Verify → **202** with a fresh run, `reused: false`. The worker ran a real capture, and the Outcome then read **Clear**, "Last verified 9/29/2026, 7:38:01 PM", with the detail page saying "FixFlags completed every required check for this Outcome."

That is the first time in this repository that an inferred Outcome went from invisible, to confirmed, to independently verified. The seeded data was reverted afterwards and the walk scripts deleted.

## The dead end was real, and it was in Settings

`SiteSettingsView` rendered "Inferred, confirmation required" against every inferred Outcome: a named requirement with no way to meet it. `components/sites/SiteOutcomeEdit.tsx` existed, was imported by nothing, and its "Looks right" button posted a kindless confirmation that `94cf309d` had already made always fail. Replacing it with `SiteOutcomeConfirm.tsx`, which offers only watchable kinds, is what turns the requirement into a control. The Outcome's own kind leads the choices when the site already answered the question, because re-asking would be the funnel-design task `docs/workspace-interface.md` rules out.

## Prevention encoded

- `lib/sites/__tests__/outcome-kind-mechanism-contract.test.ts` states the invariant for every kind: either its binding validates, or it is refused. Adding a kind to `CONFIRMABLE_OUTCOME_KINDS` cannot pass unless it is runnable.
- `lib/sites/__tests__/confirm-outcome.test.ts` pins the refusal, that the write never happens, that the message names the way forward, that CHECKOUT and AVAILABILITY stay confirmable, and that withdrawing an agreement still works without a mechanism.
- `app/api/sites/[siteId]/outcomes/__tests__/route.test.ts` pins 400 plus the code for `OUTCOME_KIND_UNWATCHABLE` and 404 still for a missing Outcome.
- `components/sites/__tests__/SiteOutcomeConfirm.test.tsx` asserts the offered buttons equal `watchableOutcomeKinds()`, derived. Naming SIGNUP and finding no button would have passed even if the control started offering an unrunnable kind, which is the defect itself.

## Red-green proof of the derivation

Making the signup config valid (`safety: 'reversible'`, `authorized: true`, `fixtureId: 'fix_selftest'`) turned exactly six assertions red: the two "current truth" contract tests, the three command refusal tests, and the component's derived-offer test. The generic contract tests stayed green, which is the correct behaviour: they state the invariant, not the current answer. Reverted afterwards.

Note for the next reader: the first attempt at this probe used only `safety` and `fixtureId` and nothing went red, because `authorized: true` is also required. A red-green probe that produces no red is evidence about the schema, not about the tests.

## How to find this class of gap again

Ask what the run path will do with the thing the customer just agreed to, then check that the agreement and the execution read one contract. A confirmation that is accepted by the write path and rejected by the run path is a promise with a timer on it. This is the second instance of that shape, after `94cf309d` on the kindless confirmation.
