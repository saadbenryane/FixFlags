---
name: fixflags
description: Ask FixFlags to independently verify important live Outcomes and prove recovery after a fix.
---

# FixFlags for OpenCode

The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect the owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

1. `ff_list_sites` and `ff_list_outcomes` discover the Site and Outcome.
2. `ff_verify_outcome` starts independent verification; `ff_get_run` returns the result.
3. `ff_list_flags` and `ff_get_flag` provide evidence when something important is broken.
4. After a fix is deployed, `ff_verify_flag` starts fresh verification; poll `ff_get_run` to prove recovery.

The agent supplies context, never the verdict. Scheduled Watch keeps running without OpenCode connected.
