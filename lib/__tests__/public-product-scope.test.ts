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
  ])('parks the power-user entry point %s', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(true)
  })

  /**
   * `AGENTS.md` and ROADMAP Gate 3 both require MCP to stay undiscoverable until the
   * Site/Outcome loop and its authorization are proven. The public surface was telling
   * the opposite: a released docs page, a setup page, and machine-readable discovery
   * documents, one of which advertised eighteen tools FixFlags does not serve,
   * including four for the explicitly parked repository-scan domain.
   */
  it.each([
    '/docs/mcp',
    '/docs/mcp/tools',
    '/docs/cli',
    '/dashboard/mcp-setup',
    '/api/well-known/mcp-json',
    '/.well-known/mcp.json',
    '/.well-known/mcp-server.json',
    '/.well-known/skills',
    '/.well-known/skills/index.json',
  ])('withholds the MCP discovery surface %s until the loop is proven', (pathname) => {
    expect(isParkedPowerToolPath(pathname)).toBe(true)
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
      '/docs/troubleshooting',
    ])
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).not.toContain('/docs/mcp')
    expect(FOOTER_COLUMNS.resources.map((link) => link.label)).not.toContain('MCP for agents')
    expect(FOOTER_COLUMNS.resources.map((link) => String(link.href))).not.toContain('/docs/integrations')
  })

  it('keeps the withheld MCP guide ready for the gate to publish', () => {
    // The page is withheld, not deleted. Losing the source would mean rewriting it
    // under time pressure on the day the evidence arrives.
    const withheld = DOCS_PAGE_DEFINITIONS.filter((page) => !DOCS_PAGES.includes(page))
    expect(withheld.map((page) => page.path)).toEqual(['/docs/mcp'])
  })

  it('publishes MCP only against a written evidence checklist', () => {
    expect(MCP_DISCOVERY_EVIDENCE.length).toBeGreaterThan(0)
    for (const line of MCP_DISCOVERY_EVIDENCE) expect(line.length).toBeGreaterThan(20)
    if (MCP_IS_DISCOVERABLE) {
      // Re-opening the gate is allowed, but the withheld paths must be deliberate.
      expect(MCP_DISCOVERY_PREFIXES).toHaveLength(0)
    }
  })
})
