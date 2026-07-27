# FixFlags Power for Kiro

## Description

FixFlags is the QA layer for AI-built products. Scan any public web app across Message, Experience, and Reach. Get Flags with fix prompts you can apply in Kiro.

## When to trigger

- User asks to scan, check, test, or review a web app
- User wants to verify a page is ready to ship
- User mentions FixFlags

## Setup

1. Pro or Studio API key from https://fixflags.com/settings
2. MCP endpoint: `https://fixflags.com/api/mcp` with `x-api-key`
3. This power file lives in-repo at `ide-integrations/kiro/fixflags-power.md` (install into Kiro from this path)

## Live MCP tools

- `ff_check_and_plan`
- `ff_get_check_status`
- `ff_get_report`
- `ff_get_rubric` (`MESSAGE` | `EXPERIENCE` | `REACH`)
- `ff_get_flag`
- `ff_get_all_fixes`
- `ff_plan_mode_prompt`
- `ff_recheck_and_compare`
- `ff_compare`
- `generate-fix-prompt`

There is no `ff_get_report_flags` tool.

## Workflow

### Scan a URL

1. Ask for a publicly accessible app URL.
2. Call `ff_check_and_plan` (prefer `waitForCompletion: true`).
3. Call `ff_get_report` for scores and `ff_get_all_fixes` for the complete ranked Fix list.
4. Present by rubric:

| Rubric | What it checks |
|--------|----------------|
| **Message** | Headline clarity, CTA specificity, audience fit, social proof, trust |
| **Experience** | Layout, mobile UX, accessibility, broken interactions |
| **Reach** | SEO metadata, social previews, privacy policy, analytics |

### Fix and re-check

Apply fix prompts in the codebase, then call `ff_recheck_and_compare` on the same URL. Re-checks are free and unlimited on owned reports.

## Notes

- Do not invent a conversational QA agent. Use Flags + fix prompts + re-check.
- Localhost is not supported.
