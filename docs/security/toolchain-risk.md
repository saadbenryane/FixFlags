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
