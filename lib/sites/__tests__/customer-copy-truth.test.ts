import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPaidOpenServer } from '@/lib/billing/paid-open'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'
import { outcomeStatusLabel } from '@/lib/sites/outcome-state'

const root = resolve(__dirname, '../../..')

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('customer-visible truth', () => {
  const siteSurfaces = [
    'components/sites/SiteBoard.tsx',
    'components/sites/SiteSettingsControls.tsx',
    'app/sites/[siteId]/outcomes/[outcomeId]/page.tsx',
    'app/sites/[siteId]/flags/[flagId]/page.tsx',
  ].map(source)

  it('uses one status vocabulary on the Site', () => {
    expect(outcomeStatusLabel('CLEAR')).toBe('Clear')
    expect(outcomeStatusLabel('FLAG')).toBe('Flag')
    expect(outcomeStatusLabel('COULD_NOT_VERIFY')).toBe('Couldn’t verify')
    expect(outcomeStatusLabel('STALE')).toBe('Stale')
    expect(outcomeStatusLabel('FLAG', true)).toBe('Verifying')
    const board = siteSurfaces[0]
    expect(board).toContain('outcomeStatusLabel')
    expect(board).not.toContain('1 required')
    expect(siteSurfaces[1]).toContain('Watch')
    expect(siteSurfaces[1]).toContain('Developer access')
    expect(siteSurfaces[2]).toContain('outcomeStatusLabel')
    expect(siteSurfaces.join('\n')).not.toMatch(/Analytics marked this Clear|paid checkout is open/i)
  })

  it('does not open paid checkout or advertise report tools as the public MCP surface', () => {
    expect(isPaidOpenServer()).toBe(false)
    const names = MCP_TOOL_DEFINITIONS.map((tool) => tool.name)
    expect(names).not.toContain('ff_get_report')
    expect(names).not.toContain('ff_check_and_plan')
    const homepage = source('lib/marketing/copy/care-homepage.ts')
    expect(homepage).not.toMatch(/paid checkout is open|Analytics marked this Clear|guaranteed recovery/i)
    expect(homepage).not.toContain('Coming later')
    expect(homepage).toContain('They do not decide whether an Outcome is Clear.')
    expect(source('lib/marketing/copy/integrations.ts')).toContain('does not scan the repository')
    expect(source('lib/marketing/copy/compare.ts')).not.toContain('values: { psi: false')
  })
})
