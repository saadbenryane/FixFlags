import { BRAND, SITE_URL } from './copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS, LLMS_TXT_PATH } from './seo-routes'

const MCP_ENDPOINT = `${SITE_URL.replace(/\/$/, '')}/api/mcp`

export function buildLlmsTxt(): string {
  const lines: string[] = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.category} Paste a URL, get evidence-backed Flags with fix prompts.`,
    '',
  ]

  for (const section of LLMS_SECTIONS) {
    lines.push(`## ${section.title}`, '')
    for (const link of section.links) {
      const url = `${SITE_URL}${link.path}`
      const suffix = link.note ? `: ${link.note}` : ''
      lines.push(`- [${link.label}](${url})${suffix}`)
    }
    lines.push('')
  }

  lines.push('## MCP Server', '')
  lines.push(
    `- FixFlags MCP server URL: ${MCP_ENDPOINT}`
  )
  lines.push(
    `- Required header: \`x-api-key: ff_live_your_key_here\``
  )
  lines.push(
    `- Get an API key: ${SITE_URL}/settings/api-keys (Pro plan required)`
  )
  lines.push(
    `- Setup guide: ${SITE_URL}/docs/mcp`
  )
  lines.push(
    '- Tools: ff_check_and_plan, ff_recheck_and_compare, ff_get_check_status, ff_get_report, ff_get_rubric, ff_get_flag, ff_plan_mode_prompt, ff_get_product_context, ff_get_current_finish_plan, ff_compare, ff_list_recent_audits, ff_start_repo_scan, ff_list_repo_scans, ff_get_repo_scan, ff_get_repo_finding, generate-fix-prompt'
  )
  lines.push('')

  return lines.join('\n').trimEnd() + '\n'
}

/** Paths indexed for sitemap guard checks (marketing pages + llms.txt). */
export function sitemapPaths(): string[] {
  return [...INDEXABLE_ROUTES.map((r) => r.path), LLMS_TXT_PATH]
}
