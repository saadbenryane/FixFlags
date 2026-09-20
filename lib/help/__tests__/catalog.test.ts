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
  it('keeps public help focused on URL-first Site care', () => {
    expect(HELP_CATEGORIES).toHaveLength(8)
    expect(HELP_ARTICLES).toHaveLength(18)
    expect(getHelpArticle('analyze-a-website')?.title).toBe('Analyze a website')
  })

  it('resolves every article slug', () => {
    for (const article of HELP_ARTICLES) {
      expect(getHelpArticle(article.slug)?.title).toBe(article.title)
    }
  })

  it('searches billing without surfacing parked power tools or credits', () => {
    const billing = searchHelpArticles('$49 waitlist')
    expect(billing.some((h) => h.article.slug === 'free-and-pro')).toBe(true)

    expect(searchHelpArticles('cursor mcp')).toEqual([])
    expect(searchHelpArticles('credit pack')).toEqual([])
  })

  it('maps failure and limit surfaces to help hrefs', () => {
    expect(helpHrefForFailureCode('HTTP_FORBIDDEN')).toContain('coverage-limitations')
    expect(helpHrefForFailureCode('SITE_FORBIDDEN')).toContain('coverage-limitations')
    expect(helpHrefForFailureCode('SITE_UNREACHABLE')).toContain('check-failed-or-stuck')
    expect(helpHrefForFailureCode('AUDIT_TIMEOUT')).toContain('check-failed-or-stuck')
    expect(helpHrefForLimitAction('buy_credits')).toContain('free-and-pro')
    expect(helpHrefForSurface('billing_past_due')).toContain('manage-an-existing-subscription')
  })

  it('keeps chat SLA strings aligned', () => {
    expect(SUPPORT_CHAT.welcomeMessage).toBe(SUPPORT_WELCOME_MESSAGE)
    expect(SUPPORT_CHAT.subtitle).toContain('few hours')
  })

  it('sets updatedAt on every help article', () => {
    expect(HELP_ARTICLES.every((article) => article.updatedAt)).toBe(true)
  })
})
