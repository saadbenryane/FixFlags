import { WEBSITE_GUIDES } from './copy/guides'
import { BLOG_POSTS, BRAND, SITE_URL } from './copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS, LLMS_TXT_PATH } from './seo-routes'
import { humanizeCheckId } from './issue-page'

const MAX_RESEARCH_LINKS = 20

export function buildLlmsTxt(reviewedIssueCheckIds: readonly string[] = []): string {
  const baseUrl = SITE_URL.replace(/\/$/, '')
  const lines: string[] = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.oneLiner}`,
    '',
  ]

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

/** Paths indexed for sitemap guard checks (marketing pages + llms.txt). */
export function sitemapPaths(options: { hasReviewedResearch?: boolean } = {}): string[] {
  return [...INDEXABLE_ROUTES.filter((route) => route.path !== '/issues' || options.hasReviewedResearch).map((r) => r.path), ...WEBSITE_GUIDES.map(guide => `/guides/${guide.slug}`), LLMS_TXT_PATH]
}
