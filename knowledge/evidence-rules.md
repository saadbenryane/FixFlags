# Evidence, health and Flag truth

**TARGET contract for the September 8 vision.** Existing serializers and stored enums require explicit adapters; this document does not claim they already implement these rules.

## Four customer statements

| Statement | Meaning | Required discipline |
| --- | --- | --- |
| Confirmed | Sufficient evidence establishes a specific problem | Show relevant behavior, source, scope and time; “confirmed twice” needs two real confirmations |
| Likely | Evidence strongly suggests a problem but does not prove the full failure | Explain the inference and missing proof; never inflate to Confirmed for copy |
| Couldn't verify | An attempt could not establish a reliable answer | Identify the gap and next useful action; a gap need not become a Flag |
| Healthy | A specific behavior passed the latest relevant check | Show scope, freshness and exclusions; not a permanent or whole-site guarantee |

These statements are not one catch-all Flag lifecycle enum. Healthy usually describes checked behavior/coverage, not a new issue. Check results can exist without Flags. Certainty, severity, priority and lifecycle are distinct dimensions.

## Evidence and coverage

Each factual result retains its Site, page/Outcome/action, expected behavior, actual observation, source, timestamp, viewport/context, capture/execution reference and limitations. Keep deterministic browser/network evidence attached to its originating source through persistence.

Coverage distinguishes configured responsibility, attempted checks, successful checks, cadence, freshness, missing permissions/context, skipped scope and failures. A healthy homepage response cannot certify a purchase. Desktop success cannot certify mobile. No Flags does not certify untested behavior.

Keep last known success and latest attempt separate. A stale pass or failed new attempt cannot silently display as current all-clear. Aggregate Site language must be bounded by relevant coverage; explicitly show unverified important Outcomes.

## Creating and prioritizing a Flag

An observation becomes a Flag only when it deserves attention. Explain what happened, where, certainty, why it matters, proof and next action. Deduplicate repeated evidence without merging distinct failures. Prioritize with certainty, impact, Outcome importance, exposure, business context, change and persistence.

Connection data is attributed and timestamped. Correlation after a deployment is a useful clue, not proof that the deployment caused a failure. Estimated exposure must not be presented as measured lost revenue.

## Fix and recovery

A proposed lifecycle is open → fix attempted → verification pending → resolved, with inconclusive/failed attempts retained and recurrence able to reopen the issue. Exact storage states belong to the implementation; do not conflate them with certainty labels.

Copy, share, agent completion, deployed code and a customer Done action cannot establish resolution. Fresh independent verification must exercise the relevant behavior after the change, in matching scope, and satisfy recorded criteria. Preserve failure and pass evidence with time and deployment/context attribution.

If the affected page disappears, a check is skipped, authentication blocks the path, or scope is incomparable, verification is inconclusive rather than resolved. An intentional removal may end a monitoring responsibility through an explicit recorded change; it is not a verified repair of that behavior.

Legacy full update reviews and IMPROVED receipts retain their current semantics on old routes. New targeted verification may reuse the engine but must meet the relevant behavior contract. Never convert old “not observed” or “Fixed” diff labels into v2 verified recovery without evidence.

## Safety and privacy

Use independent safe browser actions and minimized evidence. Do not submit real orders, payments or lead messages as routine public checks. Use owned fixtures/test modes or explicitly authorized bounded actions; otherwise record the limit. Sanitize shared/exported evidence, keep tenant data private and enforce access server-side.

AI may infer intent, correlate signals, explain and propose fixes. It cannot fabricate captures, requests, timings, customer behavior, or verification success.
