# Toolchain dependency risk

Runtime dependencies must have no moderate-or-higher known vulnerability. The
repository enforces that separately from development tooling so a build-only
advisory cannot hide a production vulnerability or stop all later verification.

## Reviewed advisory

- `GHSA-vfj7-8cjw-p6xm`, `braces <= 3.0.3`, high severity denial of service from
  deeply nested untrusted patterns.
- The package is transitive build and lint tooling only. It is not present in the
  production dependency tree or the pruned web/worker image.
- FixFlags does not accept customer-controlled glob patterns in its build or lint
  processes.
- `scripts/security-audit.mjs` accepts only this exact indirect advisory. A new
  advisory URL, direct dependency, runtime path, or different vulnerable package
  fails CI.
- Owner: runtime release. Remove this record and its scoped rule when an upstream
  patched release is available.

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
