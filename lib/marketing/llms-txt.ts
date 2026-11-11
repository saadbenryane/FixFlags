import { BLOG_POSTS, BRAND, SITE_URL } from './copy'
import { LLMS_SECTIONS } from './seo-routes'
import { humanizeCheckId } from './issue-page'
import { DOCS_PAGES } from '@/lib/docs/catalog'
import { docsMarkdownPath } from '@/lib/docs/markdown-path'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'

const MAX_RESEARCH_LINKS = 20

export function buildLlmsTxt(reviewedIssueCheckIds: readonly string[] = []): string {
  const baseUrl = SITE_URL.replace(/\/$/, '')
  const lines: string[] = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.oneLiner}`,
    '',
  ]

  lines.push('## Machine-readable documentation', '',
    `- [Complete documentation](${baseUrl}/llms-full.txt): Published guides in one plain-text response.`,
    ...DOCS_PAGES.filter(page => page.source).map(page =>
      `- [${page.title}](${baseUrl}${docsMarkdownPath(page.path)}): ${page.description}`),
    '',
  )
  if (MCP_IS_DISCOVERABLE) {
    lines.push('## MCP connection', '',
      `- [MCP server description](${baseUrl}/.well-known/mcp.json): Current tool names, scopes, and Streamable HTTP endpoint.`,
      `- [MCP endpoint](${baseUrl}/api/mcp): Requires an authorized bearer credential.`,
      `- [OAuth protected resource](${baseUrl}/.well-known/oauth-protected-resource/api/mcp): Authorization server and supported scopes.`,
      `- [OAuth authorization server](${baseUrl}/.well-known/oauth-authorization-server): Authorization, token, registration, and revocation endpoints.`,
      '',
    )
  }

  for (const section of LLMS_SECTIONS) {
    if (section.requiresReviewedResearch && reviewedIssueCheckIds.length === 0) continue
    lines.push(`## ${section.title}`, '')
    for (const link of section.links) {
      const url = `${baseUrl}${link.path}`
      const suffix = link.note ? `: ${link.note}` : ''
      lines.push(`- [${link.label}](${url})${suffix}`)
    }
    if (section.requiresReviewedResearch) {
      for (const checkId of reviewedIssueCheckIds.slice(0, MAX_RESEARCH_LINKS)) {
        lines.push(`- [${humanizeCheckId(checkId)}](${baseUrl}/issues/${checkId})`)
      }
    }
    lines.push('')
    if (section.title === 'Updates') {
      for (const post of BLOG_POSTS) {
        lines.push(`- [${post.title}](${baseUrl}/blog/${post.slug}): ${post.excerpt}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}
