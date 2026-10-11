import { BLOG_POSTS, BRAND, SITE_URL } from './copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS, LLMS_TXT_PATH } from './seo-routes'

export function buildLlmsTxt(): string {
  const baseUrl = SITE_URL.replace(/\/$/, '')
  const lines: string[] = [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.oneLiner}`,
    '',
  ]

  for (const section of LLMS_SECTIONS) {
    lines.push(`## ${section.title}`, '')
    for (const link of section.links) {
      const url = `${baseUrl}${link.path}`
      const suffix = link.note ? `: ${link.note}` : ''
      lines.push(`- [${link.label}](${url})${suffix}`)
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
export function sitemapPaths(): string[] {
  return [...INDEXABLE_ROUTES.map((r) => r.path), LLMS_TXT_PATH]
}
