# Public Markdown is a discovery surface

Date: 2026-10-06
Scope: public capability and route parity
Confidence: high

## Discovery

MCP route discovery was correctly withheld and TypeScript marketing surfaces
were guarded, but `content/docs/index.md` still rendered a direct link to the
withheld `/docs/mcp` guide. The guard inspected the Markdown loader, not the
Markdown customers actually read.

## Rule

A capability gate must cover every rendered source format. Scanning route
components or content loaders does not cover Markdown, JSON, CMS data, or other
inputs rendered through them.

## Prevention encoded

- Public Docs Markdown is part of the power-tool visibility scan.
- The private MCP guide source is exempt because the route gate withholds it;
  published Markdown is not exempt.
- The Docs index uses a generated block tied to `MCP_IS_DISCOVERABLE`, so the
  guide link appears only when the same gate publishes the guide.
- A repository-level guard test evaluates the real discovery sources rather
  than only synthetic fixtures.
- Changes under `scripts/` automatically select the script contract suite, so a
  guard cannot change without exercising its own tests.
