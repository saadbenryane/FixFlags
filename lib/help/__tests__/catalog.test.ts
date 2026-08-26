import { describe, it, expect } from 'vitest'
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getHelpArticle,
  helpHrefForFailureCode,
  helpHrefForLimitAction,
  helpHrefForSurface,
  searchHelpArticles,
  SUPPORT_WELCOME_MESSAGE,
} from '@/lib/help'
import { SUPPORT_CHAT } from '@/lib/marketing/copy'

describe('help catalog', () => {
  it('keeps public help focused on URL reviews and accounts', () => {
    expect(HELP_CATEGORIES).toHaveLength(4)
    expect(HELP_CATEGORIES.some((category) => category.id === 'mcp-and-editors')).toBe(false)
    expect(HELP_ARTICLES.every((article) => article.categoryId !== 'mcp-and-editors')).toBe(true)
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(25)
  })

  it('resolves every article slug', () => {
    for (const article of HELP_ARTICLES) {
      expect(getHelpArticle(article.slug)?.title).toBe(article.title)
    }
  })

  it('searches billing without surfacing parked power tools', () => {
    const billing = searchHelpArticles('credit pack')
    expect(billing.some((h) => h.article.slug === 'credits')).toBe(true)

    expect(searchHelpArticles('cursor mcp')).toEqual([])
  })

  it('maps failure and limit surfaces to help hrefs', () => {
    expect(helpHrefForFailureCode('HTTP_FORBIDDEN')).toContain('public-urls-only')
    expect(helpHrefForFailureCode('AUDIT_TIMEOUT')).toContain('why-check-failed')
    expect(helpHrefForLimitAction('buy_credits')).toContain('credits')
    expect(helpHrefForSurface('billing_past_due')).toContain('payment-past-due')
  })

  it('keeps chat SLA strings aligned', () => {
    expect(SUPPORT_CHAT.welcomeMessage).toBe(SUPPORT_WELCOME_MESSAGE)
    expect(SUPPORT_CHAT.subtitle).toContain('few hours')
  })

  it('sets updatedAt on every help article', () => {
    expect(HELP_ARTICLES.every((article) => article.updatedAt)).toBe(true)
  })
})
