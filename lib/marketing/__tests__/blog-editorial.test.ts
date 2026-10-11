import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BLOG_POSTS } from '@/lib/marketing/copy/blog'
import { buildBlogPostMetadata } from '@/lib/marketing/metadata'
import { blogPostingSchema } from '@/lib/marketing/structured-data'
import { SITE_URL } from '@/lib/marketing/copy/brand'

describe('blog editorial contracts', () => {
  it('uses plain copy without em dashes or stock promotional phrases', () => {
    const copy = JSON.stringify(BLOG_POSTS)
    expect(copy).not.toMatch(/\u2014/)
    expect(copy).not.toMatch(/\b(?:delve|leverage|revolutionary|game-changing|seamless|unprecedented)\b/i)
    expect(copy).not.toMatch(/QA (?:teams|roles) (?:are|have been) disappearing/i)
    expect(BLOG_POSTS[0].sections.map(section => section.paragraphs.join(' ')).join(' ')).toMatch(/vibe coding/i)
    expect(BLOG_POSTS.map(post => post.date)).toEqual([...BLOG_POSTS.map(post => post.date)].sort())
  })

  it('keeps old article URLs and gives every article a unique outline', () => {
    expect(BLOG_POSTS.map(post => post.slug)).toContain('why-ai-built-sites-need-a-launch-check')
    expect(BLOG_POSTS.map(post => post.slug)).toContain('a-deployment-is-not-proof-the-website-works')
    expect(new Set(BLOG_POSTS.map(post => post.slug)).size).toBe(BLOG_POSTS.length)
    for (const post of BLOG_POSTS) {
      expect(new Set(post.sections.map(section => section.id)).size).toBe(post.sections.length)
      expect(post.sections.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('uses the generated cover in social previews and structured data', () => {
    for (const post of BLOG_POSTS) {
      const metadata = buildBlogPostMetadata(post)
      expect(metadata.title).toBe(post.seoTitle)
      expect(metadata.description).toBe(post.excerpt)
      expect(metadata.openGraph).toMatchObject({
        type: 'article',
        publishedTime: post.publishedAt ?? post.date,
        images: [{ url: post.cover.src, width: post.cover.width, height: post.cover.height, alt: post.cover.alt }],
      })
      expect(metadata.twitter).toMatchObject({ images: [`${SITE_URL}${post.cover.src}`] })
      expect(blogPostingSchema(post)['@graph']).toEqual(expect.arrayContaining([
        expect.objectContaining({ '@type': 'BlogPosting', datePublished: post.publishedAt ?? post.date, image: expect.objectContaining({ url: `${SITE_URL}${post.cover.src}` }) }),
      ]))
      expect(readFileSync(`public${post.cover.src}`).byteLength).toBeGreaterThan(0)
    }
  })
})
