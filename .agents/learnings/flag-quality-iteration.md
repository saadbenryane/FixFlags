# Flag Quality Iteration (2026-07-13)

- Date: 2026-07-13
- Scope: Audit engine scoring, validation, deduplication, and prompt quality
- Confidence: High

## Evidence

- `lib/audit/checks/index.ts` had duplicate `security-headers` module (line 76)
- `lib/audit/persist.ts` `aiImpactToEnum()` only accepted 7 ImpactTag values while Prisma schema and TS interface had 12
- Dead components: ReportMiniNav, ExportSummaryButton, CompletenessHeader, ReportAiGate (none imported anywhere)
- Scoring model used linear penalties (CRITICAL=-25, IMPORTANT=-15, POLISH=-5) producing poor differentiation
- `validatePrescriptionOutput()` only checked completeness, not quality of fix prompts
- `suppressOverlappingFlags()` used 6 hardcoded `if` checks

## Changes Made

### Iteration 1: Bug fixes + dead code
1. Removed duplicate `security-headers` module from `checks/index.ts`
2. Added CLARITY, AUTHORITY, FRICTION, EMOTION to Prisma `ImpactTag` enum
3. Updated `aiImpactToEnum()` to accept all 11 impact tags
4. Deleted 4 dead components (ReportMiniNav, ExportSummaryButton, CompletenessHeader, ReportAiGate)
5. Removed dead `showFix` prop from ReportStickyToolbar

### Iteration 2: Scoring + validation
6. Replaced linear scoring with logarithmic penalties: `count * ln(1+count) * multiplier`
   - CRITICAL: multiplier=10, IMPORTANT: multiplier=6, POLISH: multiplier=2
   - Better differentiation: 1 CRITICAL → ~96, 2 CRITICAL → ~90, 4 CRITICAL → ~80
7. Added fix prompt quality validation:
   - Must have >=2 numbered lines
   - Must contain concrete replacements (selectors, attributes, before/after)
   - Evidence must be >=20 chars
   - whyItMatters must be >=15 chars
   - verificationRule must be >=10 chars
8. Replaced hardcoded overlap suppression with data-driven `SUPPRESSIONS` graph
9. Enhanced prescription prompt with stricter fix precision rules, better examples, tech-stack awareness

## Results

- All 1701 tests pass
- Typecheck clean
- Lint clean
- Scoring produces meaningful differentiation across flag densities

## Key Learnings

- The `checks/index.ts` barrel is the single entry point for all deterministic checks - always check for duplicates there
- ImpactTag mismatch between TS interface (12), Prisma enum (7→11), and aiImpactToEnum (7→11) was silently dropping AI-generated impact tags
- Dead code in components/audit/ can be identified by searching for imports - if a component is only defined in its own file and never imported, it's dead
- Logarithmic scoring produces much better differentiation than linear penalties for flag counts
- AI fix prompt quality can be validated at the schema level by checking for concrete patterns (element names, attribute syntax, before/after markers)
- Data-driven suppression graphs are easier to maintain than hardcoded if-chains
