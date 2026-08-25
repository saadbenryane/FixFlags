import { describe, expect, it } from 'vitest'
import { isParkedPowerToolPath } from '@/proxy'
import { DOCS_PAGES } from '@/lib/docs/catalog'
import { FOOTER_COLUMNS } from '@/lib/site/nav'

describe('URL-first public product scope', () => {
  it.each([
    '/dashboard/mcp-setup',
    '/settings/api-keys',
    '/settings/integrations',
    '/onboarding/plans',
    '/cli/authorize',
    '/report/repo/scan-1',
    '/docs/integrations',
    '/docs/cli',
    '/docs/mcp/tools',
    '/help/mcp',
    '/help/mcp-and-editors/mcp-setup',
    '/api/api-keys',
    '/api/cli/auth/device',
    '/api/integrations/github/connect',
    '/api/mcp',
    '/api/repo-scans/scan-1',
    '/api/webhooks/railway',
    '/api/well-known/mcp-json',
    '/.well-known/mcp.json',
    '/.well-known/mcp-server.json',
    '/.well-known/skills/fixflags/SKILL.md',
  ])('parks the power-user entry point %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/dashboard',
    '/settings',
    '/api/checks',
    '/api/reports/review-1/status',
    '/report/review-1',
  ])('preserves the URL review path %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(false)
  })

  it('removes power-tool documentation from public discovery', () => {
    expect(DOCS_PAGES.map((page) => page.path)).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/reports',
      '/docs/troubleshooting',
    ])
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).not.toContain('/docs/integrations')
  })
})
