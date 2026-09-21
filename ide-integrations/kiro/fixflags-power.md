# FixFlags for Kiro

FixFlags independently watches important live Outcomes. The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect an owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

Use `ff_list_sites` and `ff_list_outcomes` to discover what matters. Call `ff_verify_outcome` and poll `ff_get_run`. If FixFlags returns a Flag, inspect `ff_list_flags` and `ff_get_flag`, fix and deploy the software, then call `ff_verify_flag` and poll `ff_get_run` again. Never infer Clear from the actor's own test, deployment, or statement.

Watch remains independent of Kiro. Blocked execution means Couldn't verify, not Clear.
