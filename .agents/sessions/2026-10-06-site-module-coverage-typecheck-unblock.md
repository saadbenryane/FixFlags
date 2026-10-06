# Site module coverage TypeScript integration repair

**Task:** `site-module-coverage-typecheck-unblock-2026-10-06`
**Status:** locally verified; no behavior change; not deployed

The completed Security/Tracking receipt selection used an inline spread inside an `as const` Prisma select. The outer const assertion made the resulting `in` array readonly, while Prisma requires a mutable `string[]`. Full TypeScript failed at each use of the shared audit projection.

The repair creates the same module-key array once outside the const-selected object and passes that mutable array to Prisma. The selected target keys, query shape, and coverage calculation are unchanged.

Evidence:

- Full TypeScript passed.
- The combined coverage and developer-key focused run passed: 6 files, 40 tests.
- The 16-command affected manifest passed.
- The final full 30-command manifest passed with container receipt `.agent-runs/2026-10-06T14-52-53-492Z-container-build.log`.

No production state, customer data, deployment, or release gate changed.
