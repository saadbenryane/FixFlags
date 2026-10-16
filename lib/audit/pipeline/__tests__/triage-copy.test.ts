import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMetadataFromHtml } from '../../metadata'
import type { PipelineContext } from '../types'
import type { RenderedCopy } from '../../browser/rendered-copy'

const provider = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/judge-triage', () => ({ runTriageWithRetry: provider }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: async () => ({ parentId: null }) } } }))
import { runTriageStep } from '../triage-step'

const url = 'https://example.com/'
const copy: RenderedCopy = { version: 1, pageUrl: url, pageText: 'Plan useful projects for your team.',
  h1s: ['Plan useful team projects'], h2s: [], complete: true, textTruncated: false }
function context(): PipelineContext {
  return { auditId: 'copy-fixture', deadline: Date.now() + 120_000, startedAt: new Date(), clock: { now: () => new Date() },
    trace: { executionId: 'copy-task', traceId: 'copy-trace', attempt: 1 }, events: { log: vi.fn() },
    pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }
}
function input(renderedCopy: RenderedCopy | null) {
  return { url, metadata: { ...parseMetadataFromHtml('<h1>Your Company Name</h1><p>Lorem ipsum hidden copy</p>', url), renderedCopy },
    desktop: null, mobile: null, flags: [], desktopBase64: 'fixture', mobileBase64: null }
}
beforeEach(() => { provider.mockReset().mockRejectedValue(new Error('Controlled unavailable provider')) })
describe('triage rendered-copy boundary', () => {
  it('sends observed prose while retaining original declarations for other consumers', async () => {
    const source = input(copy)
    await expect(runTriageStep(context(), source)).rejects.toThrow('Controlled unavailable provider')
    expect(provider.mock.calls[0][1]).toMatchObject({ pageText: copy.pageText, h1s: copy.h1s })
    expect(source.metadata.pageText).toContain('Lorem ipsum')
  })
  it('withholds triage when native copy is absent or incomplete', async () => {
    for (const value of [null, { ...copy, complete: false }]) {
      await expect(runTriageStep(context(), input(value))).rejects.toThrow('Rendered page copy could not be observed')
    }
    expect(provider).not.toHaveBeenCalled()
  })
})
