---
name: fixflags
description: Ask FixFlags to independently verify important live Outcomes and prove recovery after a fix.
---

# FixFlags for OpenCode

The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect the owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

1. `fixflags.list_sites` and `fixflags.list_outcomes` discover the Site and Outcome.
2. `fixflags.run` starts independent verification; `fixflags.get_run` returns the result.
3. `fixflags.list_flags` and `fixflags.get_flag` provide evidence when something important is broken.
4. After a fix is deployed, call `fixflags.record_fix`, then pass its attempt ID to `fixflags.verify_flag`; poll `fixflags.get_run` to prove recovery.

The agent supplies context, never the verdict. Scheduled Watch keeps running without OpenCode connected.
