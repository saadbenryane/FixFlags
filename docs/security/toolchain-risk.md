---
status: supporting
authority: operations
reviewed_at: 2026-11-05
supersedes: []
---

# Toolchain dependency risk

Runtime dependencies must have no moderate-or-higher known vulnerability. The
repository enforces that separately from development tooling so a build-only
advisory cannot hide a production vulnerability or stop all later verification.

## Reviewed advisories

- `GHSA-vfj7-8cjw-p6xm`, `braces <= 3.0.3`, high severity denial of service from
  deeply nested untrusted patterns.
- The package is transitive build and lint tooling only. It is not present in the
  production dependency tree or the pruned web/worker image.
- FixFlags does not accept customer-controlled glob patterns in its build or lint
  processes.
- `scripts/security-audit.mjs` accepts only the recorded exact indirect advisories. A new
  advisory URL, direct dependency, runtime path, or different vulnerable package
  fails CI.
- Owner: runtime release. Remove this record and its scoped rule when an upstream
  patched release is available.

The November 2 integration audit also found moderate `GHSA-g3hv-75wg-m249`
through legacy ESLint adapters using `minimatch@3.1.5`. The advisory concerns
amplification from untrusted glob patterns. These lint callers receive trusted
repository configuration, never customer-controlled patterns. They require the
callable v3 API, so forcing the incompatible v11 API across those adapters is
not a safe patch. The TypeScript parser's compatible path already uses patched
`minimatch@11.0.3`. The exact indirect advisory is reviewed only for development
tooling. The runtime audit still rejects every moderate-or-higher vulnerability,
and other advisory URLs remain blocked. Remove this exception when the legacy
adapters support the patched API or receive a compatible upstream fix.

This is a bounded threat-model decision, not a blanket audit waiver. The full
toolchain report remains inspected on every validation run.

## Resolved advisory drift

On 2026-10-06 the same gate caught three newly published denial-of-service
advisories. FixFlags upgraded every affected path to the published patched
release: `source-map-js@1.2.2`, `fast-copy@4.1.2`, and
`postcss-selector-parser@7.1.6`. Exact overrides keep a later lockfile refresh
from reintroducing vulnerable transitive versions. These are fixes, not entries
in the reviewed-exception list.

Later that day, the gate caught high-severity `GHSA-wq5f-xc86-pv6w` in
`sharp@0.35.4` (and Next's transitive path to it) within minutes of publication.
The advisory marks every version below `0.35.5` vulnerable, so both the direct
dependency and exact override now require patched `sharp@0.35.5`. No exception
or audit suppression was added.

The same refresh exposed critical `GHSA-pqg4-j6r4-53mv` through
`concurrently@9.2.4` and its pinned `shell-quote@1.9.0`. The advisory fixes the
range at `1.11.0`; the exact override uses `shell-quote@1.12.0`. The dependency
remains build-only, but a patched release exists, so it is fixed rather than
added to the exception list.

The next audit refresh caught high-severity `GHSA-6qxp-vccf-f47h` in
`@modelcontextprotocol/client@2.1.0`. FixFlags imports that package only in the
MCP SDK lifecycle test, so it is now a development dependency on patched
`^2.3.1` instead of a production dependency. The advisory is fixed rather than
suppressed, and the production image must not contain the client package.

## Historical tooling audit, November 2

The November 2 npm audit reported zero production vulnerabilities and one
underlying advisory through the development lint tree:
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
That report expanded the advisory into fifteen affected package paths,
including `minimatch@3.1.5` under ESLint and its plugins. At that checkpoint the
security gate rejected it. The scoped review described above subsequently added
the exact indirect advisory to `scripts/security-audit.mjs`. Its six contract
checks passed in the November 5 source review, including rejection of direct,
new and unrelated vulnerabilities. This establishes the guard's policy, not a
fresh dependency audit or a claim that the installed advisory is fixed.

The public package metadata inspected at that checkpoint reported
`eslint@10.14.0` depending on `minimatch@^10.2.6`. The inspected import (`2.32.0`),
JSX accessibility (`6.10.2`) and React (`7.37.5`) plugins depended on
`minimatch@^3.1.2` and declared ESLint peer support through version 9. Upgrading
ESLint alone would not remove those inspected paths. Replacing the callable
legacy minimatch export with the modern object export would break its consumers.
No incompatible global override,
automatic downgrade or broad audit waiver was applied. Recheck current package
metadata before choosing an upstream migration.

The audit reports are retained locally at
`test-results/runtime/goal-dependency-audit-20261102.json` and
`test-results/runtime/goal-runtime-audit-20261102.json`. They establish the
dependency tree inspected at this checkpoint, not a guarantee about future
advisories or deployed images.
