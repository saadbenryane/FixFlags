import { describe, expect, it } from 'vitest'
import { isParkedPowerToolPath } from '@/proxy'
import { DOCS_PAGES } from '@/lib/docs/catalog'
import { FOOTER_COLUMNS } from '@/lib/site/nav'

describe('URL-first public product scope', () => {
  it.each([
    '/settings/integrations',
    '/onboarding/plans',
    '/report/repo/scan-1',
    '/docs/integrations',
    '/help/mcp-and-editors/mcp-setup',
    '/api/integrations/github/connect',
    '/api/integrations/gsc/connect',
    '/api/products/product-1/signals',
    '/api/projects/project-1/watch',
    '/api/repo-scans/scan-1',
    '/api/reports/review-1/chat',
    '/api/stripe/credit-pack',
    '/api/webhooks/railway',
  ])('parks the power-user entry point %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/dashboard',
    '/settings',
    '/dashboard/mcp-setup',
    '/cli/authorize',
    '/settings/api-keys',
    '/docs/mcp',
    '/docs/cli',
    '/docs/mcp/tools',
    '/api/api-keys',
    '/api/cli/auth/device',
    '/api/mcp',
    '/api/well-known/mcp-json',
    '/.well-known/mcp.json',
    '/.well-known/mcp-server.json',
    '/.well-known/skills',
    '/.well-known/skills/fixflags/SKILL.md',
    '/.well-known/skills/index.json',
    '/api/checks',
    '/api/reports/review-1/status',
    '/report/review-1',
  ])('preserves the URL review path %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(false)
  })

  it('discovers only the released product documentation', () => {
    expect(DOCS_PAGES.map((page) => page.path)).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/site-care',
      '/docs/mcp',
      '/docs/troubleshooting',
    ])
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).toContain('/docs/mcp')
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).not.toContain('/docs/integrations')
  })
})
