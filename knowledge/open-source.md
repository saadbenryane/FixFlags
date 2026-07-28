# Open-source strategy

**Canonical home for what to open vs keep proprietary.** Vision: [vision.md](./vision.md).

## Rule

Do not open-source the entire company. Open the parts that create trust, portability, and adoption. Keep the compounding intelligence proprietary.

## Potentially open (later, demand-triggered)

- Local runtime / CLI surface
- Repository file format / Product Intelligence schema (portable projection)
- MCP server protocol surface
- Agent skill (lightweight loop adoption, not full engine) — roadmap: [ROADMAP.md](../ROADMAP.md) **Open community skills**
- Basic checks
- Integration SDK
- Product Intelligence Protocol (vendor-neutral)

The open layer should work independently.

## Community skills (planned)

Thin orchestration over MCP and CLI. Skills teach agents the Check → Fix → Verify loop; they do not ship the Integrity Engine.

| Layer | Location today | OSS target |
|-------|----------------|------------|
| Core loop skill | `public/.well-known/skills/fixflags/`, `ide-integrations/` | Standalone `fixflags-skills` repo |
| Editor rules | `ide-integrations/cursor/`, `claude-code/`, `kiro/` | Same repo, per-editor install paths |
| Platform extensions | — | Community contributions (`fixflags-lovable`, launch-gate, Re-check-only, etc.) |
| Operator skills | `.cursor/skills/fixflags-*` | Proprietary (contributor tooling only) |

Planned repo shape: `skills/` (SKILL.md per workflow), `rules/` (Cursor `.mdc`), `integrations/` (Claude Code, Kiro), `mcp/mcp.json.example`, and CI that validates tool names against the published MCP contract.

Gate: ship after Distribution harden and MCP proof so install paths point at a stable CLI/MCP surface. See [ROADMAP.md](../ROADMAP.md).

## Keep proprietary

- Advanced reasoning and orchestration
- Benchmark data and ranking systems
- Cross-product pattern models
- Advanced verification
- Commercial collaboration features
- Enterprise controls
- Learning infrastructure
- Global research dataset
- Intelligence Network dashboards and team workflows

## Today

| Artifact | Status |
|----------|--------|
| `fixflags-cli/` | In-repo thin MCP client; not marketed as published npm global until publishable |
| `ide-integrations/` | In-repo proto for Cursor / Claude Code / Kiro; extract to OSS repo per roadmap |
| `public/.well-known/skills/fixflags/` | Canonical core loop skill source; same extraction target |
| Cloud app + Integrity Engine | Closed |
| Customer Product Intelligence | Customer-owned data; not OSS |

Do not cut an OSS release before Phase 1 thesis signals (persistent PI, Fix list value, verify/remember). See [execution.md](./execution.md).
