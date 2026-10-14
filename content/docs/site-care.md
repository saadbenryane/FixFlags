## Site board

Your **Site** is your website and its saved results in FixFlags. **Overview** groups results into areas such as Pages, Conversion, Security, Search, Performance, and Tracking. Open an area to see its findings and what was checked.

Check the date and any limits beside a result. The labels mean different things:

- **Healthy**: the checks for that area passed and the results are recent.
- **Partial**: some checks finished, but others could not.
- **Unknown** or **Not checked yet**: FixFlags does not have enough information yet.
- **Stale**: the last result is too old to describe the website now.

No Flags does not tell you whether an unchecked area works.

## Workspace

Use the website sidebar to move between:

- **Overview**: see results and open problems.
- **Timeline**: see earlier checks and changes after fixes.
- **Integrations**: see planned connections and manage removal of any previously saved connection.
- **Settings**: choose a monitoring schedule and email preferences.

The Timeline graph shows Flag counts from website-wide checks. Your first check is the starting point; more checks build a trend. Checks that could not finish leave gaps rather than counting as zero. Checks of one area or action appear in the history below the graph.

## Flags and evidence

A **Flag** is a problem FixFlags found that needs attention. Open it to see the affected page, what happened, when it was checked, why it matters, and a suggested fix. Screenshots and check details help you understand the finding.

You may also see **Recommendations**, suggestions for improvements. These do not count as Flags or trigger Flag emails.

## Verify

After publishing a fix, return to the Flag and select **Check now**. FixFlags checks the same page or action again and keeps the result with the original problem.

- **Verified**: the new check confirms the fix worked.
- **Still open**: the problem remains.
- **Regressed**: the result got worse.
- **Could not verify**: FixFlags could not confirm the result, for example because the page was blocked.

Copying a prompt or publishing a change does not close a Flag. FixFlags needs a new result that confirms the fix.

## Watch

Newly saved websites receive a default monitoring schedule. Open **Settings** to see the interval and next check time. You can change the interval or pause monitoring at any time. A website you previously paused stays paused until you restart monitoring.

Scheduled monitoring checks the areas FixFlags supports for your website. Read each area's results to see what was checked and what could not be checked.

Choose which Flag emails you want in Settings. You can also choose emails when a previously flagged problem is confirmed fixed. Routine successful checks stay quiet. Settings shows delayed or failed scheduled checks and how to retry.

<!-- generated:public-offer -->

## Automatic account checks

If **Settings** offers automatic account checks, you can enable tests of signup and signed-in pages. FixFlags keeps one test account for later checks and uses a separate temporary account for signup and deletion tests.

Regular monitoring reuses the saved test account. New signup tests run at setup, after significant signup-form changes, or when requested. Some sign-in methods cannot be tested. FixFlags shows those limits and reports whether cleanup deleted its test accounts.

## Shopify connection

[Shopify](/docs/integrations/shopify), Analytics, and Search Console are coming soon. GitHub account authorization is available. [Planned integrations](/integrations) are separate from the independent website checks available now.

## Get help

- [Understand what was checked](/help/sites-and-coverage/read-site-coverage)
- [Read a Flag](/help/flags-fix-verify/read-a-flag)
- [Check a fix](/help/flags-fix-verify/verify-a-flag)
- [Set up monitoring](/help/watch-and-notifications/weekly-watch)
