import { describe, expect, it } from 'vitest'
import { isParkedPowerToolPath } from '@/proxy'
import { DOCS_PAGES, DOCS_PAGE_DEFINITIONS } from '@/lib/docs/catalog'
import { FOOTER_COLUMNS } from '@/lib/site/nav'
import {
  MCP_DISCOVERY_EVIDENCE,
  MCP_DISCOVERY_PREFIXES,
  MCP_IS_DISCOVERABLE,
} from '@/lib/mcp/discoverability'

describe('URL-first public product scope', () => {
  it.each([
    '/onboarding/plans',
    '/report/repo/scan-1',
    '/help/mcp-and-editors/mcp-setup',
    '/api/integrations/github/repos',
    '/api/integrations/github/select',
    '/api/integrations/gsc/connect',
    '/api/products/product-1/signals',
    '/api/projects/project-1/watch',
    '/api/repo-scans/scan-1',
    '/api/reports/review-1/chat',
    '/api/stripe/credit-pack',
  ])('parks the power-user entry point %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(true)
  })

  /**
   * MCP discovery was withheld under ROADMAP Gate 3 and opened by owner decision on
   * 2026-11-10. Every surface below now describes only the tools in the registry and the
   * `/api/mcp` transport. `/docs/cli` and `/docs/mcp/tools` redirect to `/docs/mcp`.
   */
  it.each([
    '/docs/mcp',
    '/docs/mcp/tools',
    '/docs/cli',
    '/dashboard/mcp-setup',
    '/api/well-known/mcp-json',
    '/.well-known/mcp.json',
    '/.well-known/mcp-server.json',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
    '/.well-known/skills',
    '/.well-known/skills/index.json',
  ])('serves the MCP discovery surface %s now that discovery is open', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(false)
  })

  it('keeps the MCP transport and its authorization reachable', () => {
    // Withholding discovery must not break an already-connected client. A parked
    // transport would break working software instead of an unproven promise.
    for (const pathname of ['/api/mcp', '/api/api-keys', '/api/cli/auth/device', '/cli/authorize', '/settings/api-keys']) {
      expect(isParkedPowerToolPath(pathname), `${pathname} must stay reachable`).toBe(false)
    }
  })

  it.each([
    '/',
    '/dashboard',
    '/settings',
    '/settings/integrations',
    '/api/integrations/github/connect',
    '/api/integrations/github/callback',
    '/api/integrations/github/disconnect',
    '/api/api-keys',
    '/api/cli/auth/device',
    '/api/mcp',
    '/api/webhooks/railway',
    '/api/oauth/token',
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
      '/docs/fix-with-ai',
      '/docs/mcp',
      '/docs/integrations',
      '/docs/integrations/github',
      '/docs/integrations/shopify',
      '/docs/integrations/google-analytics',
      '/docs/integrations/google-search-console',
      '/docs/troubleshooting',
    ])
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).not.toContain('/docs/integrations')
  })

  it('publishes the MCP guide now that discovery is open', () => {
    // The guide stays gated by `MCP_IS_DISCOVERABLE`, so closing discovery withholds it again.
    expect(MCP_IS_DISCOVERABLE).toBe(true)
    const withheld = DOCS_PAGE_DEFINITIONS.filter((page) => !DOCS_PAGES.includes(page))
    expect(withheld).toEqual([])
  })

  it('keeps the outstanding MCP evidence checklist while discovery is open', () => {
    expect(MCP_DISCOVERY_EVIDENCE.length).toBeGreaterThan(0)
    for (const line of MCP_DISCOVERY_EVIDENCE) expect(line.length).toBeGreaterThan(20)
    if (MCP_IS_DISCOVERABLE) {
      // Re-opening the gate is allowed, but the withheld paths must be deliberate.
      expect(MCP_DISCOVERY_PREFIXES).toHaveLength(0)
    }
  })
})
