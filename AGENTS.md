---
status: canonical
authority: operations
reviewed_at: 2026-10-10
supersedes: []
---

# FixFlags repository guide

Use the smallest amount of project context needed for the task. Explicit user direction takes precedence over repository guidance.

## Working safely

- Check `git status --short` before writing and preserve unrelated changes.
- Inspect the implementation and focused tests before changing behavior.
- Use `npm run agent -- context <area>` only when the task needs an authority map; do not load every linked source by default.
- Check `npm run agent -- ownership` before work that could overlap another writer. Claim a scope only when coordination is actually needed.
- Never reset, clean, stash, overwrite, or discard another worker's changes.

## Authority

- [CANONICAL-SOURCES.md](CANONICAL-SOURCES.md) maps product and engineering authority.
- Code and tests describe current behavior. Plans, reviews, sessions, handoffs, history, and prototypes are evidence, not instructions.
- Do not present planned behavior as shipped or broaden public claims beyond evidence.
- For auth, billing, sharing, webhooks, encryption, middleware, or tenant access, read [SECURITY.md](SECURITY.md).
- Exact rendered customer copy lives in `lib/marketing/copy/`; [docs/voice-and-copy.md](docs/voice-and-copy.md) contains principles and vocabulary only.

## Validation

- Run the smallest focused check that exercises the changed behavior.
- Use broader suites for shared contracts, security-sensitive work, migrations, or release boundaries.
- Do not select a repository-wide check merely because unrelated files are dirty.
- Exercise the real path when the risk justifies it and state any remaining uncertainty.

Environment and commands: [DEVELOPMENT.md](DEVELOPMENT.md). Coordination details: [.agents/README.md](.agents/README.md).
