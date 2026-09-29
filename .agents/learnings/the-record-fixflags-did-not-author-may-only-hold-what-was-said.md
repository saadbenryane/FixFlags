# The record FixFlags did not author the change may only contain what someone said

**Date:** 2026-09-29. **Found while** auditing the Flag → Fix → Verify loop for claims the
product could not back.

## The defect

`lib/sites/application/commands.ts` read:

```ts
changeSummary: command.changeSummary ?? initialFlag.expectedBehavior,
```

`expectedBehavior` is what should be true **after** a fix. So for every verification started
from the web product, the attempt row said someone had changed the thing that ought to become
true. The Flag detail page's history read:

> Contact form shows a confirmation after submit

as the change the customer made.

This is worse than an empty field, and the reason is specific to this product. An attempt
record exists so a reader can believe that FixFlags did not author the change and then
independently judged it. The value of the record is entirely in its provenance. Writing
FixFlags' own expectation into the provenance slot destroys the one property that makes the
record worth keeping, and it does so silently, in the field a customer would check first.

Two supporting facts made it invisible:

- The web `verify` route never sent a `changeSummary` at all, so the fallback always fired.
- The web `fix` route accepted only `action: 'copy'`, so the product's entire notion of "Fix"
  was a clipboard event. The loop step that answers the vision's fifth question, *what needs
  to change?*, recorded that a prompt had been copied.

And the test asserted the fabricated value. `records READY_TO_VERIFY and scopes capture to the
Flag page` expected
`changeSummary: 'Contact form shows a confirmation after submit'`. A defect that a test
pins is a defect that survives review, because the test looks like evidence of correctness.

## Why the fallback existed and why removing it was the whole fix

`ImprovementAttempt.changeSummary` is `String?`. It was nullable all along. The fallback was
not satisfying a constraint; it was avoiding `undefined` in a column that had never required
it. So the honest fix was to delete it rather than to invent a replacement value.

Removing it raises a real product question: should a customer be allowed to Verify without
describing what they did? Yes. Someone who fixed the code and has nothing to add still
deserves an independent check, and refusing them would be a worse product than an honest gap.
So the field is optional on the way in and the absence is stated on the way out:

- `SiteFlagActions` gained an optional "What did you change?" field above Verify.
- The verify route accepts an optional, length-bounded `changeSummary`.
- The attempts list renders the customer's words, or `No change described`.

The copy button stays. Copying a prescription to your agent is genuinely useful. It just
stopped being the fix record.

## The rule

**A field that records provenance must never be filled from anything the system itself wrote
about the desired state.** If the system has to put something there, the record is about the
system's belief, not the customer's action, and it belongs in a different column under a
different name.

The general form: any fallback of the form `userInput ?? <what the product expected>` is
fabricating a user action. Search for that shape, not just for this instance. A related one
survives in the same area: `lib/integrity/site-flag.ts` set `Improvement.status = 'VERIFIED'`
from a single GREEN probe, which the Site Agent reads as "fixed". Two writers, one field, two
meanings — and the weaker writer was the one the customer saw.

## Red-green

The new test asserts the absence directly rather than the presence of a corrected value:

```ts
expect(recorded?.changeSummary).toBeUndefined()
expect(JSON.stringify(recorded)).not.toContain('Contact form shows a confirmation')
```

A test that only asserted `changeSummary === 'something else'` would have passed again the
moment someone re-added a different fallback. Asserting that the expected behavior text
appears **nowhere** in the recorded fix is the assertion that states the invariant.
