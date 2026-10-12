## Site board

A Site is the lasting home for one website. Its starter board covers Pages, Conversion, Security, Search, Performance, and Tracking. Shopify adds purchase-path evidence to Conversion. Supported checks are discovered automatically. Overview groups Flags and check results by category. There is no check-selection wizard.

Cards show the latest check attempt and the latest completed evidence separately. They show freshness, scope, and exclusions. Unknown, partial, stale, and healthy are different states. No Flags never means an untested area is healthy.

## Workspace

The website sidebar contains Overview, Timeline, Integrations, and Settings. Overview contains all categorized Flags. Timeline shows recorded checks, rechecks and verified recoveries. Integrations manages optional connections directly. Settings controls monitoring and notifications.

## Flags and evidence

A customer Flag is a meaningful problem supported by evidence. It includes the affected page or Journey, evidence source and time, bounded certainty, limitations, why the problem matters, a proposed change, and an exact success condition.

Recommendations remain in card depth. They do not badge the Site, enter the Flag inbox, or trigger notifications.

## Verify

Verify records a new attempt for the selected Flag and checks the relevant page or action again. The result is Verified, Still open, Regressed, or Could not verify. Blocked, missing, skipped, removed, or incomparable evidence never resolves the Flag.

## Watch

<!-- generated:public-offer -->

Monitoring uses the Site’s configured coverage. A Watch schedule does not guarantee that every page or action has been checked. Read the coverage and limitations for each area. Healthy Watch runs stay quiet. New and recurring customer Flags can notify according to the Site preference, and a verified recovery can notify independently.

Watch is active only after its schedule is saved. A delayed or failed schedule remains visible and retryable in Site settings.

Use the schedule control in Site settings to change the interval or stop monitoring. During open beta, you can choose any supported schedule for your one website. Read [Pricing](/pricing) for the temporary offer, and confirm the next run in Site settings.

## Automatic account checks

When automatic account checks are available, Settings provides one switch for signup and signed-in inspection. FixFlags reuses one test account and uses a separate disposable account for signup and deletion tests. Test emails use plus aliases, and supported verification links and codes are handled automatically.

Routine monitoring does not create another account. Disposable signup tests run initially, after material signup-form changes, or when explicitly requested. Unsupported authentication and unverified deletion remain visible limitations. The cleanup action reports whether FixFlags test accounts were actually deleted.

## Shopify connection

Shopify is an optional connection to the same owned Site. Purchase-path evidence belongs with Conversion and Flags. Follow the [Shopify integration guide](/docs/integrations/shopify) for setup, permissions, coverage, and removal. See [all integration guides](/docs/integrations) for traffic and search context.

## Get help

- [Read Site coverage](/help/sites-and-coverage/read-site-coverage)
- [Read a Flag](/help/flags-fix-verify/read-a-flag)
- [Verify a Flag](/help/flags-fix-verify/verify-a-flag)
- [Monitoring during open beta](/help/watch-and-notifications/weekly-watch)
