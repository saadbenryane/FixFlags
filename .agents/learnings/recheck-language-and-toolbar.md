# Re-check language and report toolbar

- Date: 2026-07-12
- Scope: Core loop copy, pricing promises, report actions, and responsive report navigation
- Confidence: High

## Evidence

- `PRODUCT.md`, `SOUL.md`, and `DECISIONS.md` define the core loop as Flag -> Fix -> Re-check.
- Re-checks are free and unlimited on owned reports. `canAccessMonitoring()` returns true and re-check creation skips usage counting.
- Pro currently adds 25 new URL checks per month, before/after comparison, and MCP.
- A real owned report was run locally and inspected at 1280x720 and 375x812.

## Discovery

- User-facing copy had renamed the free re-check action to "Monitor" and sometimes sold "unlimited monitoring" as a Pro benefit.
- The pricing page therefore contradicted both the entitlement code and canonical product docs.
- The report toolbar repeated Re-check as both a section tab and an owner action. With Project, Share, and Export present, that clipped Rubrics at 1280px and forced 115px of page overflow at 375px.

## Correct approach

- Use "Re-check" for the user action everywhere. Keep `monitoring` only in internal routes, database fields, scheduler types, and the stable `ff_monitoring` MCP tool name.
- State the plan boundary plainly: re-checks stay free; Pro sells more new checks, compare, and MCP.
- Owners get the primary Re-check button without a duplicate Re-check section tab. Non-owners keep the section link for wayfinding.
- Below `xl`, stack report actions and section navigation on separate rows. Keep actions wrapped inside the report width.
- Use a screen-reader label for compact Project assignment rather than spending toolbar width on a repeated visible label.

## Prevention

- `lib/__tests__/homepage-message.test.ts` rejects Monitor/re-scan drift in the core loop and rejects pricing that treats re-checks as paid value.
- Report, pricing, auth, checkout, compare, and nurture copy now use the same product terms.
- `DETERMINISTIC_SCAN_VERDICT` is reused by the deterministic finalize path instead of duplicating gate copy.

## Remaining risks

- Existing database rows may retain old locked-copy strings until those reports are regenerated.
- If scheduled monitoring becomes a real paid surface, it needs a separate product definition and must not rename or gate the manual re-check action.
- Internal `monitoring` identifiers can still leak into UI if new copy bypasses the canonical marketing and report copy objects.
