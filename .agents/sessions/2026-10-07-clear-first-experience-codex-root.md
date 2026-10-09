# Clear first experience: integrated candidate in progress

Owner: codex-root. Branch: main. Scope: clear-first-experience-2026-10-07.

## Customer test corrections

Owner testing rejected the empty Outcomes heading, Add check naming, a full problem list ahead of the retained card grid, and nested progress/activity disclosures. The corrected local Overview leads with identity and visible milestones, then one flat grid. Confirmed visitor actions share the grid without conflating their assessments with category health. Detailed Flags remain on Flags/card depth. Detailed activity opens separately and summarizes at most one latest receipt per stage. Old-attempt receipts and repetitive per-page events do not become a customer log dump. Inferred unconfigured Signup is no longer represented as an added card.

Architecture, workspace-interface, card-board and design-system skill body were reconciled with this owner direction. No launch, paid, MCP, or customer-value gate was weakened.

## Implemented, not released

Managed local launcher accepts an explicit port and starts web plus one worker without killing unrelated processes. Manual execution readiness fails closed before reservation. Scheduled Watch requests retain durable acceptance/recovery. Shared Site resource, screenshot provenance, activity projection, owner-scoped page/Signup creation, Add library, explicit Watch cadence application, Open/Resolved labels, and card styling are implemented in the current uncommitted candidate.

The restored grid and non-nested visible progress were inspected on the real local Site at desktop and 393px mobile. Desktop evidence: `/tmp/fixflags-visible-progress-desktop.jpg`. Those observations are UI evidence, not proof that the complete end-to-end release is ready.

## Execution evidence and defect

Original Site `cmuye35ta0001ongqkynst4h0`, Audit `cmuye35tm0003ongqhpoej3p7`: the initial queued job had AUDIT_JOB_LOST, no start time, pages, or screenshots. The managed runtime at localhost:3107 captured 24 pages and 49 screenshots. This execution produced stored findings but ended with AI_CONTRACT_INVALID; do not call it a successful complete review.

Polling/cron recovery used a flat five-minute deadline while deep reviews use the existing depth-dependent deadline. Recovery, polling selects, and health diagnostics now use that shared policy. A regression checks that a six-minute depth-3 review is not falsely timed out. The worker must load the candidate and a fresh run must prove terminal success before the next readiness claim.

## Verification

- Full unit suite: 495 files passed, 3 skipped; 5,934 tests passed, 18 skipped (before the last small progress-state/mobile-header refinements).
- Focused board/activity checks: 37 passed; board/activity/recovery set: 63 passed.
- Final focused board/activity/recovery checks: 66 passed. Final typecheck and lint passed.
- Full repository verification, build/image inspection, complete local acceptance matrix, production deployment, and customer validation remain outstanding.

## Resume

Owner's second visual correction: the Overview had too much text. The local refinement uses a compact Watch row, short visible milestone labels, one answer per evidenced card, arrow-only depth actions with retained accessible labels, and a concise Flag total. Removed redundant impact paragraphs and Add-tile instructions. Known technical finding titles have exact presentation-only plain-language mappings; original diagnoses and evidence are unchanged. Partial reviews now offer an owner-scoped Check again action with network/refusal feedback. Unknown-card limitations remain visible. This is local refinement, not a declaration of integrated launch completion.

Further owner testing rejected even the shortened milestone checklist: pipeline bookkeeping is not a customer answer. The latest Overview has one current status and direct recovery. Milestones and receipt history are available only in the separate Activity dialog, without nested disclosures. The canonical contract and design-system skill now encode this distinction. The lesson is to communicate the customer's state, not merely abbreviate implementation steps. Full unit suite passed 5,937 assertions before this final narrow Activity refinement; focused tests and visual checks cover that final change separately.

Owner also rejected the card-depth dump of 25 identical finding rows. Card detail now leads with a category icon and severity groups, defaults to the highest nonempty priority, shows short icon-led finding cards with affected-page context, and explicitly paginates large groups. Suggestions remain distinct; evidence/scope follows the action queue. Existing Flag IDs and detail URLs are preserved. Unconfirmed inferred action names were removed from the displayed verified-scope facts. Structured-queue tests exercise priority switching, seven-finding pagination, and suggestion separation.

Latest local verification: 40 focused board/detail tests passed; typecheck and lint passed. A separate browser tab verified the actual Conversion queue (2 Critical, 23 Important, 10 suggestions), priority switching, and pagination from findings 1–6 to 7–12. Screenshot `/tmp/fixflags-structured-card-detail.jpg`. Overview evidence `/tmp/fixflags-one-answer-desktop.jpg`. The owner's active test tab was not navigated for these final checks. Dialog close targets now satisfy the existing 44px rule. Full candidate/release and successful fresh review verification still remain open.

Keep BOARD ownership in progress. Complete guided Signup and command failure handling, capability/configuration truth, fresh-worker retry verification, real auth/claim/Flags/Watch browser journeys, and the required full checks. Do not expose MCP or activate payment. Preserve the actual partial evidence and failures while resolving the pipeline; never convert them into Clear or call traffic readiness from UI tests alone.

## Owner-directed information architecture and account pass

The October 7 owner review was implemented on the running local product. Home now presents saved websites as full-width rows with preview, domain, a combined page-reach result, Watch state, Flag total, and a compact Add website row. Site Overview places the Flag total beside the domain and Watch in the top-right, removes the redundant Overview subtitle and standalone Watch/Uptime cards, orders problem cards first, renders `24/24 pages reached` in Pages, puts Flag totals at card footers, and offers one aggregate Copy all prompt per problem card. The Add card control is now the clearer Add to this website tile.

Card depth defaults to Fix first, keeps one Flag per row, gives each Flag one View destination and one Copy prompt action, and presents checked pages as card cells rather than divider rows. The full Flags page now has Open/Resolved state, category tags, Fix first and Other Flags sections, compact rows, and pagination. The live local `saadbenryane.com` Site, its Conversion and Pages dialogs, the Flags page, account Settings, and API keys were inspected in the in-app browser at localhost:3107. The final Pages card visibly rendered `24/24 pages reached`; the separate Uptime card was absent.

Account Settings now names Security accurately, separates connected sign-in accounts from passkeys and two-factor authentication, and no longer labels Password as Connected. API keys are first-class left navigation, use the customer-facing name API keys, and ask only for name and expiration while stating their fixed full FixFlags access. Expiration and revocation remain visible safety controls. This is local product work; no key was created and no production state changed.

Final evidence:

- Relevant UI regression set passed 60/60, followed by contract repair sets of 74/74 and Site board 31/31.
- UI drift guard, TypeScript, scoped lint, and the complete repository manifest passed.
- Final unit receipt: `.agent-runs/2026-10-07T23-09-36-270Z-test-unit.log`, 496 files passed, 3 skipped; 5,945 tests passed, 18 skipped.
- Final 30-command verification passed, including the production container build: `.agent-runs/2026-10-07T23-13-11-753Z-container-build.log`, image manifest `sha256:8ae958f7005ff9c20ea6444bffdc14209e422632f94c82f9b51d9096dbc5ba62`.
- No deploy, paid-access change, MCP discovery change, or production readiness claim was made.

## October 9 product completion pass

The owner-approved completion plan is now reconciled into the same Site product. Websites Home uses one Analyze entry and full-width resource rows. Site Overview keeps the retained category-card grid but presents one answer per card, central result/monitoring/coverage/freshness truth, priority ordering, and one contextual Add action. Category depth and Flags share the durable Improvement projection, Fix first / Other Flags grouping, affected scope, Copy fix prompt, and stable View Flag destinations. Flag detail now leads from observation and expected behavior into evidence, action, and fresh Verify fix history.

Settings, Account, API keys, Billing, and authenticated navigation were simplified around customer responsibilities. Site Settings is owner-only in both navigation and route access. Account separates Profile, Sign-in methods, Security, and Danger zone. API-key creation asks only for a name and expiration while preserving server-side scope truth. The homepage sample uses one Add action for coverage and connections. Customer copy and design contracts, drift guards, and the canonical product/interface documents were updated with the implementation.

Verification receipts:

- Responsive web-only UI evaluation passed: `.agent-runs/2026-10-09T04-45-19-909Z-eval-ui.log`.
- Full repository verification passed all 30 commands, including 500 unit-test files (497 passed, 3 skipped) and 5,971 tests (5,954 passed, 17 skipped), security, drift, type, lint, production build, and container build: `.agent-runs/2026-10-09T04-54-22-949Z-container-build.log`.
- Next.js was upgraded from 15.5.24 to 15.5.27 to remove the runtime cache-poisoning advisories; the permanent runtime dependency audit is clean.
- The local candidate was exercised in the real browser. Owner navigation exposes Settings after session hydration; logged-out component coverage proves Settings and the monitoring mutation link are absent. The Settings route now requires `requireSiteOwner`.
- Heartbeat at `2026-10-09T04:54:27.368Z` reported no blocked or queued work. External client, exact-SHA deployment/canary, and 14-day/100-run monitoring gates remain outside this local implementation proof. MCP discovery and paid access remain closed.
