# FixFlags for Kiro

FixFlags independently watches important live Outcomes. The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect an owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

Use `fixflags.list_sites` and `fixflags.list_outcomes` to discover what matters. Call `fixflags.run` and poll `fixflags.get_run`. If FixFlags returns a Flag, inspect `fixflags.list_flags` and `fixflags.get_flag`, fix and deploy the software, call `fixflags.record_fix`, then pass its attempt ID to `fixflags.verify_flag` and poll `fixflags.get_run` again. Never infer Clear from the actor's own test, deployment, or statement.

Watch remains independent of Kiro. Blocked execution means Couldn't verify, not Clear.
