# FixFlags for Claude Code

FixFlags independently watches important live Outcomes. The canonical workflow is `public/.well-known/skills/fixflags/SKILL.md`. Connect an owned account through [MCP setup](https://fixflags.com/dashboard/mcp-setup).

1. Use `fixflags.list_sites` and `fixflags.list_outcomes` to select the exact owned Outcome.
2. Call `fixflags.run`, then poll `fixflags.get_run` for Clear, Flag, or Couldn't verify.
3. For a Flag, inspect `fixflags.list_flags` and `fixflags.get_flag` before changing code.
4. Deploy the fix. Call `fixflags.record_fix`, then pass its attempt ID to `fixflags.verify_flag` and poll `fixflags.get_run` for independent recovery proof.

The requesting agent may give commit or deployment context but cannot certify success. Scheduled Watch continues without Claude Code connected.
