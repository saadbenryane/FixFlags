import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { scopeTaskArtifact } from '../results'
import { serializeArtifact } from '../contracts'

describe('category findings admission', () => {
  it('filters shared action findings before they are committed or persisted for finalization', () => {
    const search = { checkId: 'title-missing', rubric: 'REACH', severity: 'IMPORTANT', problem: 'Title missing', evidence: 'No title', fix: 'Set title', confidence: 1, source: 'DETERMINISTIC' }
    const security = { ...search, checkId: 'no-https', problem: 'HTTP' }
    const original = serializeArtifact('flow', { flags: [search, security] })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', environment: 'production', targetUrl: 'https://example.com/',
      category: { area: 'search', sourceAuditId: 'full', pages: ['https://example.com/'] }, checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }
    const filtered = scopeTaskArtifact(original, spec)
    expect(filtered.data.flags).toEqual([search])
    expect(original.data.flags).toHaveLength(2)
    expect(scopeTaskArtifact(original, { ...spec, scope: 'SITE', category: undefined })).toBe(original)
  })
})
