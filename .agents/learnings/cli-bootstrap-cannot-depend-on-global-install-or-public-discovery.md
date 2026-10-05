# CLI bootstrap cannot depend on a global install or public discovery

Date: 2026-10-05
Scope: npm CLI, editor MCP setup, evidence-gated discovery
Confidence: high

## Evidence

`npx fixflags init` completed but generated `command: fixflags`, while `command -v fixflags` returned nothing. When that command was repaired, the real setup still failed because it tried to download the customer skill from the deliberately hidden MCP discovery route and received 404.

## Discovery

A one-command installer must leave a durable launch path after its own process exits. It also cannot depend on a public route that the same release plan requires to remain hidden until client verification passes. Otherwise the verification prerequisite depends on already opening the gate it is meant to protect.

## Correct approach

- Launch the exact immutable npm version through the package runner, not an assumed global binary or a floating dist-tag.
- Keep secrets in the credential store and out of generated configuration and arguments.
- Bundle immutable setup material, such as the customer skill, in the candidate artifact.
- Preserve one canonical skill source and mechanically verify the bundled copy.
- Distinguish client config parsing from authenticated end-to-end client proof.

## Prevention encoded

- CLI tests assert exact-version `npx` arguments for JSON and TOML configs and prove init succeeds without a public skill endpoint.
- Package checks require the bundled `SKILL.md` and reject source or dependency leakage.
- `skills:sync` copies the canonical customer skill into the CLI; `skills:validate` fails on any drift.
- The npm-operations skill and release runbook require actual-client parsing before promotion.
