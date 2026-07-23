# Open-source strategy

**Canonical home for what to open vs keep proprietary.** Vision: [vision.md](./vision.md).

## Rule

Do not open-source the entire company. Open the parts that create trust, portability, and adoption. Keep the compounding intelligence proprietary.

## Potentially open (later, demand-triggered)

- Local runtime / CLI surface
- Repository file format / Product Intelligence schema (portable projection)
- MCP server protocol surface
- Agent skill (lightweight loop adoption, not full engine)
- Basic checks
- Integration SDK
- Product Intelligence Protocol (vendor-neutral)

The open layer should work independently.

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
| `ide-integrations/` | Distributed docs/skills for Cursor / Claude Code |
| Cloud app + Integrity Engine | Closed |
| Customer Product Intelligence | Customer-owned data; not OSS |

Do not cut an OSS release before Phase 1 thesis signals (persistent PI, Fix list value, verify/remember). See [execution.md](./execution.md).
