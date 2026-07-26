# Technical Architecture Spec

**Canonical home for the FixFlags technical architecture specification.** Current implementation: [ARCHITECTURE.md](../ARCHITECTURE.md). Vision: [vision.md](./vision.md).

## Architecture principle

**Deterministic where possible. Agentic where necessary. Verified before reporting.**

Browser agents remain unreliable on long or ambiguous tasks. The strongest system in one 2026 benchmark completed 44.5% of long-horizon tasks. The architecture must reflect this reality.

## System layers

### A. Discovery layer

Build a normalized route graph from: sitemap, robots file, public navigation, internal links, client-side routes, form actions, canonical URLs.

Prevent route explosion by: removing tracking parameters, grouping template-equivalent routes, limiting pagination, limiting calendar states, limiting filtered collections, respecting domain and path boundaries, excluding logout and destructive routes.

### B. Deterministic checker

Use Playwright and direct HTTP checks for: link status, redirects, route availability, button targets, form labels, console errors, failed requests, missing assets, mobile overflow, touch targets, metadata, indexability, structured data, accessibility rules, performance signals, social previews.

### C. Goal runner

Use an AI agent only when the next action cannot be reliably predetermined.

Each agent run receives: one goal, one starting state, allowed domains, allowed actions, forbidden actions, maximum actions, maximum retries, explicit success assertion, explicit failure conditions, stop conditions.

Use DOM interaction first. Use visual computer control only when: the DOM is unavailable or misleading, the control is canvas-based, drag-and-drop is required, visual placement is part of the task.

### D. Verification layer

A journey passes only when FixFlags verifies the end state.

Accepted assertions: expected URL reached, expected element visible, success response received, record created, test webhook received, email captured in a test inbox, expected state found through a permitted API, database record confirmed through an integration.

The agent saying "done" is not an assertion.

### E. Judgment layer

The reviewer receives selected evidence rather than the complete raw run. It evaluates: confirmed failures, repeated actions, contradictory interface states, missing feedback, high-impact mobile differences, message problems attached to important paths, trust problems attached to sensitive actions.

### F. Fix compiler

The fix package contains: goal, problem, evidence, expected behavior, suggested implementation, likely files when repository access exists, constraints, verification condition.

### G. Re-check engine

Reproduce: same environment, same account state, same browser, same viewport, same goal, same assertion. Show a before-and-after comparison.

### H. Change intelligence

When connected to a repository or deployment: read changed files, map files to routes and components, map routes to saved journeys, select affected checks, avoid rerunning unrelated journeys.

## CLI, MCP and integrations

### CLI

```bash
npx fixflags check
```

The CLI should: detect the local product, read `fixflags.yml`, run cheap deterministic checks, start or connect to a preview URL, trigger a hosted Finish Check, return a concise result, exit nonzero only for confirmed blockers when enabled.

### MCP

MCP allows a coding agent to: read active Flags, fetch evidence, fetch the fix contract, mark a fix as attempted, request a re-check, read the verification result.

MCP is a delivery surface. It should not be the homepage story.

### Initial integrations (priority order)

1. GitHub
2. Vercel or deployment URL webhooks
3. Cursor, Claude Code and Codex through MCP
4. Lovable and Replit through copy-ready prompts and deep links
5. Slack after recurring team demand is proven

### Later evidence connectors

Connect rather than recreate: Sentry for production errors, PostHog for analytics and replay, FullStory for behavioral evidence, Maze for real usability research.
