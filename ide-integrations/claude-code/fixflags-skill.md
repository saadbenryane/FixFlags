# FixFlags for Claude Code

FixFlags independently watches important live Outcomes. The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect an owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

1. Use `ff_list_sites` and `ff_list_outcomes` to select the exact owned Outcome.
2. Call `ff_verify_outcome`, then poll `ff_get_run` for Clear, Flag, or Couldn't verify.
3. For a Flag, inspect `ff_list_flags` and `ff_get_flag` before changing code.
4. Deploy the fix. Call `ff_verify_flag` and poll `ff_get_run` for independent recovery proof.

The requesting agent may give commit or deployment context but cannot certify success. Scheduled Watch continues without Claude Code connected.
