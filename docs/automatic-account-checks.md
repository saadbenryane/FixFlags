---
status: supporting
authority: engineering
reviewed_at: 2026-10-12
supersedes: []
---

# Automatic account checks

Account checks run through the existing progressive worker. A Site-wide run may admit the `automatic-accounts` task; explicit signup retests and cleanup use the isolated `ACCOUNT_CHECKS` scope. Existing Safe Form fixtures retain their own contracts.

## Enablement

Account execution is disabled by default. Use FixFlags' own `fixflags.com` domain in the existing Resend account. Its sending records and receiving MX record must be verified independently. Route `email.received` events to `https://fixflags.com/api/webhooks/resend/receiving` and configure that endpoint's signing secret as `RESEND_RECEIVING_WEBHOOK_SECRET`. Another project's mailbox or webhook does not provide FixFlags receiving infrastructure. `ACCOUNT_TEST_EMAIL` must be the base mailbox without an existing plus alias. The existing Resend API key must permit retrieving received email. Credentials and session storage require `TOKEN_ENCRYPTION_KEY`.

Use `RESEND_FROM_EMAIL="FixFlags <hello@fixflags.com>"` for outbound mail and `ACCOUNT_TEST_EMAIL=checks@fixflags.com` for test accounts. Configure the mailbox, webhook secret, and execution gates consistently on the web and worker services. Stage Railway variable updates with `--skip-deploys` when the receiving route is not deployed yet.

For the current Resend domain in the Europe region, add this receiving record in Cloudflare. If the Resend domain region changes, use the receiving value returned by Resend for that domain instead.

| Type | Name | Mail server | Priority | TTL |
| --- | --- | --- | --- | --- |
| MX | `@` | `inbound-smtp.eu-west-1.amazonaws.com` | `10` | Auto |

Keep the dedicated webhook disabled until DNS receiving is verified and the deployed FixFlags route accepts correctly signed requests and rejects invalid signatures. Enable that webhook after deploying the route and its signing secret. The separate account execution gates remain disabled until lifecycle verification is complete.

Set `ACCOUNT_CHECKS_LIFECYCLE_VERIFIED=true` and `ACCOUNT_CHECKS_ENABLED=true` only after controlled verification establishes actual mailbox delivery, signature rejection, successful signup and login, session reuse, disposable deletion, and failed/unknown cleanup behavior. Unit checks alone do not establish compatibility with a live customer website. These flags do not override ownership, the Site preference revision, or entitlement.

## Supported execution

The initial adapter uses discovered same-origin HTTPS forms with email/password fields and recognized synthetic profile fields. Verification accepts clearly labelled codes and same-origin verify/confirm/activate links. Third-party identity providers, CAPTCHA, mandatory unsupported fields, purchases, arbitrary app-data mutations, invitations and cross-origin authentication remain unsupported.

A retained identity supports private signed-in navigation, response checks, browser-error observations and automated accessibility inspection. Inspection is bounded to eight declared links inside the existing task deadline. Public and signed-in findings use distinct check identities and contexts. No account secrets, raw email contents or verification tokens are written to task artifacts or public-safe receipts.

One disposable slot is reserved per Site origin. Routine unchanged checks do not rotate it. Material form changes and explicit retests may replace a verified-deleted disposable slot. An unresolved slot is reconciled before any replacement. Submission admission is persisted before the browser sends a request, and the browser allows at most one mutation per selected auth operation.

Deletion requires credential-bound access to the selected identity. A deletion message or logout alone is insufficient: the adapter tests the previously working login in a fresh browser session. Missing deletion controls and inconclusive login outcomes remain unavailable or unknown. Routine execution never deletes the retained account; explicit owner cleanup may do so.

Owner cleanup remains available after checks are paused or entitlement changes. It requires the exact current Site revision and decryptable stored credentials, but does not require new-account admission or an enabled receiving inbox. An unsubmitted reservation is canceled without opening a browser or creating an account. Its receipt states that no account was submitted and does not claim an observed account-deletion flow. A concurrent change leaves cleanup inconclusive.

## Recovery and privacy

Preference changes increment a revision, fencing previously queued account work. Current permission and execution ownership are checked immediately before privileged requests. Interrupted signup uses the same identity and never repeats the creation request. Verification messages expire after 15 minutes. Expired data is purged on receiving or the next account run, and opt-out removes pending verification data. Timed-out verification retains the identity for later reconciliation.

Receiving checks the raw Svix signature and timestamp, deduplicates the provider email ID, and matches one exact active test recipient before fetching email content. Only extracted verification data is encrypted and retained. Browser storage is encrypted and restricted to the stored origin when restored.

## Local validation

Run the account contract, inbox, reservation, executor, settings-route, account-action-route, receiving-webhook, and progressive-graph tests. Run type checking, focused lint, and UI guards. Apply the additive migration to the local development database, then run `npm run db:check` and `npm run db:drift`. Browser or end-to-end execution requires an explicit request under repository validation rules.

References: [Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), [received-email retrieval](https://resend.com/docs/api-reference/emails/retrieve-received-email), and [Svix signature verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).
