import { describe, expect, it } from 'vitest'
import { getHelpArticle } from '@/lib/help/search'
import { helpArticleStructuredData, docsStructuredData } from '@/lib/marketing/structured-data'
import { getDocsPage } from '@/lib/docs/catalog'
import { HELP_CATEGORIES } from '@/lib/help/catalog'

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
})
