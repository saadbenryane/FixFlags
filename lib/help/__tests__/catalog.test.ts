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
  it('has five categories and day-one articles', () => {
    expect(HELP_CATEGORIES).toHaveLength(5)
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(18)
  })

  it('resolves every article slug', () => {
    for (const article of HELP_ARTICLES) {
      expect(getHelpArticle(article.slug)?.title).toBe(article.title)
    }
  })

  it('searches billing and MCP topics', () => {
    const billing = searchHelpArticles('credit pack')
    expect(billing.some((h) => h.article.slug === 'credits')).toBe(true)

    const mcp = searchHelpArticles('cursor mcp')
    expect(mcp.some((h) => h.article.slug === 'mcp-setup')).toBe(true)
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
})
