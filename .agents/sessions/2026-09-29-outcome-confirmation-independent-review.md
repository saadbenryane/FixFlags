# Outcome confirmation independent review, 2026-09-29

Reviewed commit: `f1e5e47092d85f575acbfa4999aef7c6d34d4efa`.

Scope: independent read-only review delegated by codex-root. Implementation ownership remains with opencode and their existing review scope. No product, board, dependency, environment or build files were changed. Unrelated JEV research changes were preserved. This receipt is the only write authorized for this follow-up.

Status: two concrete behavior defects reproduced locally with in-memory dependency fakes; client/server import leakage verified in existing production build artifacts. No production or authenticated browser journey was executed. No credentials, provider calls, customer email, or database mutations were used.

## P1: confirming a different mechanism preserves an unsupported promise

Relevant source at reviewed commit:

- `components/sites/SiteOutcomeConfirm.tsx:47` posts `{ outcomeId, confirmed: true, kind }`, with no revised promise or target.
- `lib/sites/outcomes.ts:418` constructs the selected binding with `input.site.url`.
- `lib/sites/outcomes.ts:430` keeps `outcome.name` unless a new name was explicitly provided.
- `lib/sites/outcomes.ts:437` replaces expectation with the kind's default.
- `lib/sites/outcomes.ts:45` identifies the Availability mechanism as `HTTP_AVAILABILITY`; its config uses the Site URL and `expectedSelector: 'body'`.
- `components/sites/SiteBoard.tsx:177` passes the retained name into the Outcome card; `components/sites/OutcomeSummaryCard.tsx` places that name beside the assessment state.
- `lib/sites/application/checkout-execution.ts:214` implements the availability observation: successful response plus rendered content, without support-form interaction.

### In-memory reproduction

Read the actual `lib/sites/outcomes.ts`, transpile with installed TypeScript using `module: CommonJS` and `target: ES2022`, then execute in `node:vm`.

Mocks:

- `@/lib/db`: `siteOutcome.findFirst` returns the row below; `siteOutcome.update` merges its `data` into that row; `outcomeExecutionBinding.upsert` captures the created binding and supplies its view fields. No real database is loaded.
- `@/lib/analytics/site-events`: lifecycle recording resolves without external effects.
- `@/lib/sites/outcome-state`: returns the latest supplied state, otherwise `COULD_NOT_VERIFY`.
- `@/lib/sites/application/binding-config`: returns validation success. This mock is not involved in `confirmSiteOutcome`'s name/target update; this reproduction makes no claim to independently validate the Availability binding schema.

Input stored row:

```json
{
  "id": "out-support",
  "name": "Contact support",
  "slug": "contact-support",
  "description": "Visitors can contact support",
  "kind": "GENERIC",
  "inferenceSource": "browser",
  "confirmedAt": null,
  "criticality": "IMPORTANT",
  "environment": "production",
  "expectation": null,
  "pages": [],
  "bindings": [],
  "assessments": [],
  "runSelections": []
}
```

Function invocation:

```js
await confirmSiteOutcome({
  site: { kind: 'project', projectId: 'site-1', url: 'https://example.test/' },
  outcomeId: 'out-support',
  confirmed: true,
  kind: 'AVAILABILITY',
})
```

Observed output and captured binding:

```json
{
  "name": "Contact support",
  "kind": "AVAILABILITY",
  "expectation": "The public page responds successfully.",
  "mechanism": "HTTP_AVAILABILITY",
  "config": { "startUrl": "https://example.test/", "expectedSelector": "body" },
  "description": "Visitors can contact support"
}
```

This proves the name/description and executable condition diverge. Source inspection confirms the Home card presents the retained name beside its resulting state. No browser run was performed to produce Clear in this review; the risk of displaying “Contact support” as Clear follows from the actual binding and card projection, not a claimed live customer observation.

### Smallest coherent correction

Make the actual proposed promise and target explicit before confirmation, and persist that agreed promise. For unsupported inferred intent, prefer retaining the original suggestion and using the existing `confirmPageAvailability` path to create/confirm “This page loads” separately. If conversion in place is retained, replace the inferred name and description coherently and handle old bindings/assessments so evidence for a previous promise cannot certify a new one. Do not silently turn support/signup intent into homepage availability.

Acceptance:

1. A GENERIC “Contact support” suggestion cannot become a Clear support Outcome solely because the homepage responds.
2. Availability confirmation clearly identifies the page and what is verified; its stored name, description, expectation, binding target and displayed evidence agree.
3. Unsupported intent remains honest and recoverable rather than being erased by a narrower check.
4. Existing Checkout confirmation preserves the applicable purchase-path binding and target.

## P2: the new confirmed-Outcome Edit control always receives a kind-required error

Relevant source:

- `components/sites/SiteOutcomeConfirm.tsx:108` sends `confirmed: outcome.confirmedAt !== null` and `name`, with no kind.
- `lib/sites/application/commands.ts:63` rejects any confirmed request without kind, before calling `confirmSiteOutcome`.
- `app/api/sites/[siteId]/outcomes/route.ts` forwards that payload unchanged and maps `OUTCOME_KIND_REQUIRED` to HTTP 400.
- The rename success branch at `components/sites/SiteOutcomeConfirm.tsx:114` also has no router refresh, so allowing persistence alone would leave the rendered name stale.
- The component test “renames a confirmed Outcome without re-agreeing to it” mocks fetch success and checks only the request body. It does not exercise the rejecting command.

### In-memory reproduction

Read the actual `lib/sites/application/commands.ts`, transpile to CommonJS, and execute in `node:vm`.

Mocks:

- `@/lib/sites/ensure-site.loadSiteRecord` resolves `{kind:'project', projectId:'site-1', url:'https://example.test/'}`.
- `@/lib/marketing/copy.OUTCOME_CONFIRMATION.kindRequired` is the sentinel string `kind required`.
- Other imports return empty objects because the command exits at the guard before those imports are used. No database, HTTP route or authenticated session is invoked.

Input:

```json
{
  "type": "CONFIRM_OUTCOME",
  "siteId": "site-1",
  "outcomeId": "out-1",
  "confirmed": true,
  "name": "Renamed checkout"
}
```

Actual result:

```json
{ "ok": false, "error": "kind required", "code": "OUTCOME_KIND_REQUIRED" }
```

The sentinel only replaces display copy; the returned code and guard are the real implementation. HTTP 400 is established by the route mapping, not by an HTTP request in this review.

### Smallest coherent correction

Give rename explicit semantics, or recognize an owned existing Outcome edit without weakening initial-confirmation checks. Preserve kind, binding configuration and confirmation time. Merely resending kind from the UI would call binding upsert with the Site root and can overwrite a configured Checkout start URL. Refresh the server-rendered name after a successful edit and show a usable network-error state.

Acceptance:

1. An owned confirmed Outcome can be renamed through the real route/command path.
2. Rename does not alter kind, expectation, binding start URL, confirmation time or assessment truth.
3. Cross-Site rename remains rejected; a fresh kindless confirmation remains rejected.
4. After save, the visible name updates without a manual page reload.
5. Route rejection and network failure leave an actionable message and allow retry.

## Client/server import boundary: leakage confirmed, hydration crash not reproduced

`components/sites/SiteOutcomeConfirm.tsx:9` imports runtime `watchableOutcomeKinds` from `lib/sites/outcomes.ts`. That module imports `@/lib/db` at line 1; `lib/db.ts` constructs Prisma at module initialization.

Existing local production build evidence:

- `.next/static/chunks/app/sites/[siteId]/settings/page-9d704d228949e2c0.js`, filesystem timestamp September 29 19:25:31, contains module `72678` exporting `SiteOutcomeConfirmList` and the expression `null!=globalThis.prisma||new d.PrismaClient({log:["error"]})`.
- `.next/static/chunks/8804-c3adddbd26f0af18.js` contains module `59072` forwarding to Prisma browser module `19570`, and the Prisma browser error string.
- Chunk sizes were 18,984 bytes and 138,198 bytes respectively. These are complete chunk sizes, not a measurement of Prisma's incremental bundle cost.

Reproduction: evaluate those exact two existing chunks in a VM whose `self.webpackChunk_N_E.push` captures their module factories. Execute actual modules `59072`, `19570` and their browser runtime dependency. Supply a minimal webpack `require`/export helper and empty objects for unrelated UI imports, then evaluate Settings module `72678`.

Observed:

```text
Prisma browser constructor result: c {}
Settings component module evaluated
```

The bundled Prisma browser constructor returns an inert proxy; construction alone did not throw. Its error string is not evidence of a hydration failure. This VM probe checks module initialization, not React hydration or a rendered page. The existing build artifact was inspected rather than rebuilt, and no claim of exact commit-to-build attestation is made.

Correction: move kind/binding capability helpers into a pure module with no database imports, or compute offered kinds on the server and pass them as serializable props. Keep `SiteOutcomeView` imports type-only. Preserve derivation from the execution validator rather than introducing a separate manually maintained capability list.

Acceptance:

1. The actual built Settings client dependency graph does not initialize or bundle Prisma because of the Outcome confirmation control.
2. Offered kinds remain consistent with server confirmation and binding validation.
3. A real browser loads Settings and completes the intended confirmation/edit flow without client errors.
4. Add a boundary regression guard that would fail if the Client Component again imports the database-bearing module at runtime.

## Handoff

These are review findings for opencode's existing scope, not authorization for another owner to overwrite their work. Codex-root received the reproduction results in chat. No implementation was attempted by this reviewer. Broader passing tests and build claims for the commit do not resolve the two reproduced contract mismatches; the targeted acceptance conditions above are the next useful evidence.
