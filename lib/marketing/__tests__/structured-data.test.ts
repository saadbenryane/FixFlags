import { describe, expect, it } from 'vitest'
import { BLOG_POSTS, SEO } from '@/lib/marketing/copy'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getHelpArticle } from '@/lib/help/search'
import {
  blogPostingSchema,
  docsStructuredData,
  helpArticleStructuredData,
  helpHubStructuredData,
  issueIndexStructuredData,
  issuePageSchema,
  publicReportStructuredData,
  toolPageStructuredData,
} from '@/lib/marketing/structured-data'
import { getDocsPage } from '@/lib/docs/catalog'

describe('structured data', () => {
  it('emits TechArticle and BreadcrumbList for help articles', () => {
    const article = getHelpArticle('first-check')
    const category = HELP_CATEGORIES.find((item) => item.id === 'getting-started')
    expect(article).toBeDefined()
    expect(category).toBeDefined()

    const schema = helpArticleStructuredData(article!, category!)
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'BreadcrumbList' }),
        expect.objectContaining({ '@type': 'TechArticle', headline: article!.title }),
      ])
    )
  })

  it('adds HowTo schema for step-based help articles', () => {
    const article = getHelpArticle('claiming-a-report')
    const category = HELP_CATEGORIES.find((item) => item.id === 'getting-started')
    const schema = helpArticleStructuredData(article!, category!)
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([expect.objectContaining({ '@type': 'HowTo' })])
    )
  })

  it('keeps docs structured data centralized', () => {
    const page = getDocsPage('getting-started')
    const schema = docsStructuredData(page)
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'BreadcrumbList' }),
        expect.objectContaining({ '@type': 'TechArticle', headline: page.title }),
      ])
    )
  })

  it('emits help hub CollectionPage and ItemList', () => {
    const schema = helpHubStructuredData(HELP_CATEGORIES)
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'CollectionPage' }),
        expect.objectContaining({ '@type': 'ItemList' }),
      ])
    )
  })

  it('emits issue index CollectionPage', () => {
    const schema = issueIndexStructuredData([{ checkId: 'missing-alt-text', title: 'Missing alt text' }])
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'CollectionPage' }),
        expect.objectContaining({
          '@type': 'ItemList',
          itemListElement: expect.arrayContaining([
            expect.objectContaining({ url: expect.stringContaining('/issues/missing-alt-text') }),
          ]),
        }),
      ])
    )
  })

  it('adds breadcrumbs to issue detail schema', () => {
    const schema = issuePageSchema({
      checkId: 'missing-alt-text',
      title: 'Missing alt text',
      description: 'Images without alt text.',
      rubric: 'EXPERIENCE',
      siteCount: 20,
      occurrenceCount: 40,
      path: '/issues/missing-alt-text',
    })
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([expect.objectContaining({ '@type': 'BreadcrumbList' })])
    )
  })

  it('emits BlogPosting schema for blog posts', () => {
    const post = BLOG_POSTS[0]
    const schema = blogPostingSchema(post)
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'BlogPosting', headline: post.title }),
      ])
    )
  })

  it('emits WebApplication schema for tools', () => {
    const schema = toolPageStructuredData({
      path: '/tools/meta-preview',
      name: SEO.metaPreview.title,
      description: SEO.metaPreview.description,
    })
    expect(schema['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'WebApplication', name: SEO.metaPreview.title }),
      ])
    )
  })

  it('emits WebPage schema for public reports', () => {
    const schema = publicReportStructuredData({
      reportId: 'abc123',
      reviewedUrl: 'https://example.com',
      title: 'example.com report · FixFlags',
      description: 'Automated FixFlags report.',
    })
    expect(schema).toMatchObject({
      '@type': 'WebPage',
      url: expect.stringContaining('/report/abc123'),
      about: { '@type': 'WebSite', url: 'https://example.com' },
    })
  })
})
