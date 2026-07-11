import { describe, it, expect } from 'vitest'
import {
  resolveAuditOutcome,
  hasPrimaryTriage,
} from '@/lib/audit/pipeline/outcome'
import type { PageRun } from '@/lib/audit/pipeline/types'
import { healthyMeta } from './check-fixtures'

function stubPageRun(overrides: Partial<PageRun> = {}): PageRun {
  return {
    pageId: 'p1',
    url: 'https://example.com',
    metadata: healthyMeta(),
    desktop: null,
    mobile: null,
    desktopScreenshot: true,
    mobileScreenshot: true,
    flowScan: false,
    failedModules: [],
    desktopBase64: 'img',
    mobileBase64: null,
    flags: [],
    detectedTech: [],
    industryGuess: null,
    ...overrides,
  }
}

describe('resolveAuditOutcome', () => {
  it('returns triage_complete when primary has triage', () => {
    const runs = [stubPageRun({ triage: { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 't' } } })]
    expect(resolveAuditOutcome(runs)).toEqual({ kind: 'triage_complete', pageRuns: runs })
  })

  it('returns triage_degraded when primary triage failed', () => {
    const runs = [
      stubPageRun({
        triageFailure: {
          reason: 'no_provider_keys',
          message: 'OPENAI_API_KEY is not configured',
          retryable: false,
        },
      }),
    ]
    const outcome = resolveAuditOutcome(runs)
    expect(outcome.kind).toBe('triage_degraded')
    if (outcome.kind === 'triage_degraded') {
      expect(outcome.reason).toBe('no_provider_keys')
    }
  })

  it('hasPrimaryTriage ignores secondary pages without triage', () => {
    const runs = [
      stubPageRun({ triage: { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 't' } } }),
      stubPageRun({ pageId: 'p2', triage: undefined }),
    ]
    expect(hasPrimaryTriage(runs)).toBe(true)
  })
})
