---
status: supporting
authority: evidence
reviewed_at: 2026-10-29
supersedes: []
---

# Notification completion plan

The notification experience must help an owner understand what changed, decide what to do next, and control what reaches their inbox. This plan covers account preferences, website alerts, summaries, onboarding messages, delivery evidence and release acceptance. It builds on the existing Site board, current findings, monitoring receipts and shared brand components.

## Product decisions

- Summaries follow monitoring by default, with daily, weekly and off choices. Check schedules and email schedules remain distinct.
- Website alerts retain their existing per-website controls. Turning off summaries does not silently turn off alerts.
- Product tips require a separate choice. Unsubscribing from tips cannot disable security messages or website alerts.
- Account Settings owns email scheduling and delivery history. Website Settings owns which website changes trigger alerts.
- Email shows current recorded findings, incomplete checks and stale results honestly. Targeted verification cannot replace the website's complete state.
- A provider accepting a message, a recipient server accepting it and a person reading it are separate facts.

## Implementation sequence

1. **Shared contracts and clean boundaries.** Separate preference storage, schedule admission, summary projection and delivery. Share the eligibility rules and immutable message contract. Preserve existing alert identities and historical receipts.
2. **Scheduling and truthful results.** Cover clock changes, timezone offsets, changed monitoring, empty and paused accounts, competing workers, isolated failures and expired claims. Preserve current findings and show stale evidence explicitly.
3. **Delivery evidence and suppression.** Verify signed provider events from the original bytes, deduplicate them, retain early events until acceptance is recorded and handle out-of-order outcomes. Show failures and prevent continued notification attempts after a confirmed bounce or complaint.
4. **Account and website experience.** Show the next delivery and current effective frequency. Hide controls that do not apply. Preserve edits on failure, validate saved responses, protect unsaved changes and show useful delivery states without implying a human read the email.
5. **Email consistency and opt-out.** Keep HTML small, table based and free of external fonts or scripts. Supply matching plain text, clear actions, readable dates and preference links. Separate requested product tips and implement signed, scanner-safe unsubscribe handling.
6. **Verification and release.** Exercise database claims, receipt recovery, webhook signatures, tenant isolation, preference races, opt-outs and rendering contracts. Run focused component tests, typecheck, source lint, design guards, migration replay and schema drift checks. Prepare representative email previews.

## Acceptance boundaries

- Local tests establish software behavior against disposable resources. They do not establish inbox placement, physical-device rendering or production delivery.
- Deployment requires the migration, matching web and worker revisions, the configured delivery webhook and its own signing secret.
- Live acceptance requires an authorized test message, a real provider receipt, a signed delivery event and review in the intended inbox clients. A naturally scheduled summary must also be observed.
- The requested pre-launch account cleanup remains a separate pending choice. No websites are removed through this plan.

## Research basis

[Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests) requires authenticating the original request body. [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) provide a 24-hour deduplication window, so a stable key cannot justify indefinite replay.

[Gmail sender guidance](https://support.google.com/mail/answer/14229414?hl=en) distinguishes promotional unsubscribe requirements from transactional messages. [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html) defines the signed-list-header and POST contract for one-click unsubscribe. A preference page alone does not implement that contract.

[Twilio's explanation of Apple Mail privacy](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/understanding-apple-mail-privacy-protection-and-open-events) describes automatic image fetching that can inflate open events. Open events are unsuitable as proof that a person read an alert.

## Verification record

The local implementation covers steps 1 through 5 and the software checks in step 6. Preference storage, schedule admission, summary projection and delivery have separate modules. Summaries use the website board's current findings and coverage. Settings shows effective cadence, separate product-tip consent, delivery history and actionable delivery failures. Profile and email forms share one unsaved-navigation guard.

`node scripts/verify-notifications.mjs` passed 234 focused tests across 23 files against two fresh disposable PostgreSQL databases. The command replayed the migration history, confirmed no Prisma schema drift and removed its databases afterward. The tests cover concurrent sends, changed preferences, removed or transferred Sites, targeted checks, stale evidence, provider signatures, repeated and early events, normalized event identity, suppression, consent, unsubscribe scanning and receipt recovery.

TypeScript, focused source lint, 17 route/module/style guard tests, brand and UI guards, the route registry and module boundary guard passed. The isolated production web build completed with 150 static pages, and the worker bundle built successfully. Browser E2E and real inbox rendering are separate acceptance gates and were not run.

Read-only production inspection on 2026-10-29 found verified SPF and DKIM records, a published DMARC record and disabled open/click tracking for fixflags.com. The outbound delivery webhook and `RESEND_DELIVERY_WEBHOOK_SECRET` were not configured. No production migration or deployment was performed, and no customer email was sent.

### Remaining live acceptance

1. Promote the reviewed notification changes without including unrelated working-tree edits. Apply the notification migration and deploy matching web and worker revisions.
2. Configure the outbound delivery webhook and its dedicated signing secret. Keep inbound receiving separate. Confirm signed events reach the deployed handler.
3. With explicit sending authorization, send a representative message to the intended inbox. Match the actual provider message ID, the signed delivery event and Settings history. Review HTML and plain text in the intended email clients. For product tips, also inspect the one-click headers and their DKIM coverage.
4. Observe one naturally scheduled summary, including its current findings, recorded check times, chosen time zone and preference links.
5. Resolve the separate account-cleanup choice before removing websites.

These live gates remain open. Local checks and provider configuration do not establish inbox placement, human reading, production scheduling or whole-app release acceptance.
