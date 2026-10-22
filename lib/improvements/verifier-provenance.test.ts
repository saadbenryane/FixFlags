import { describe, expect, it, vi } from 'vitest'
import {
  recordVerifierExecution,
  recordTargetedPageVerifierExecutions,
  verifierScopeKey,
  verifierTargetKey,
} from './verifier-provenance'

describe('verifier execution provenance', () => {
  it('does not use ordinary page capture as slow connection proof', async () => {
    const upsert = vi.fn()
    const db = { audit: { findUnique: vi.fn().mockResolvedValue({ parentId: 'before' }) }, improvementAttempt: {
      findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: ['slow-3g-blank-screen', 'slow-3g-cta-delayed'].map(checkId => ({
        flag: { source: 'DETERMINISTIC', checkId, pageUrl: 'https://example.com/', fingerprint: null },
      })) } }]),
    }, auditVerifierExecution: { upsert } }
    expect(await recordTargetedPageVerifierExecutions({ auditId: 'after', pageUrl: 'https://example.com/', primary: true,
      failedModules: [], flowCompleted: true, availableTools: ['html-parse', 'browser-capture', 'flow-navigation'] }, db as never)).toBe(0)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('persists the exact check and normalized page scope idempotently', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'execution-1' })
    await recordVerifierExecution({
      auditId: 'review-2',
      source: 'DETERMINISTIC',
      checkId: 'cta-dead-link::page:2',
      pageUrl: 'https://example.com/#pricing',
      status: 'COMPLETED',
      evidenceReference: { run: 'checker-run-1' },
    }, { auditVerifierExecution: { upsert } } as never)

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        auditId_targetKey_scopeKey: {
          auditId: 'review-2',
          targetKey: 'check:cta-dead-link',
          scopeKey: 'page:https://example.com/#pricing',
        },
      },
      create: expect.objectContaining({ status: 'COMPLETED' }),
    }))
  })

  it('requires stable AI identity and keeps scope separate from target identity', () => {
    expect(verifierTargetKey({ source: 'AI', checkId: null, fingerprint: null })).toBeNull()
    expect(verifierTargetKey({ source: 'AI', checkId: null, fingerprint: 'evidence-1' }))
      .toBe('ai:evidence-1')
    expect(verifierScopeKey('https://example.com/pricing/')).toBe('page:https://example.com/pricing/')
    expect(verifierScopeKey('https://example.com/pricing/')).not.toBe(verifierScopeKey('https://example.com/pricing'))
  })

  it('records positive coverage only for the exact targeted page checker', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'execution-1' })
    const db = {
      audit: { findUnique: vi.fn().mockResolvedValue({ parentId: 'review-1' }) },
      improvementAttempt: {
        findMany: vi.fn().mockResolvedValue([
          {
            improvement: {
              occurrences: [
                {
                  flag: {
                    source: 'DETERMINISTIC',
                    checkId: 'og-image-missing',
                    fingerprint: null,
                    pageUrl: 'https://example.com/pricing',
                  },
                },
                {
                  flag: {
                    source: 'AI',
                    checkId: null,
                    fingerprint: 'unstable-ai-wording',
                    pageUrl: 'https://example.com/pricing',
                  },
                },
              ],
            },
          },
        ]),
      },
      auditVerifierExecution: { upsert },
    }

    await expect(recordTargetedPageVerifierExecutions({
      auditId: 'review-2',
      pageUrl: 'https://example.com/pricing',
      primary: true,
      failedModules: [],
      flowCompleted: false,
      availableTools: ['html-parse', 'browser-capture'],
    }, db as never)).resolves.toBe(1)

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        targetKey: 'check:og-image-missing',
        status: 'COMPLETED',
        evidenceReference: expect.objectContaining({ verifier: 'og-image-missing' }),
      }),
    }))
  })

  it('records failed coverage when the applicable checker run was degraded', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'execution-1' })
    const db = {
      audit: { findUnique: vi.fn().mockResolvedValue({ parentId: 'review-1' }) },
      improvementAttempt: {
        findMany: vi.fn().mockResolvedValue([{
          improvement: {
            occurrences: [{
              flag: {
                source: 'DETERMINISTIC',
                checkId: 'og-image-missing',
                fingerprint: null,
                pageUrl: null,
              },
            }],
          },
        }]),
      },
      auditVerifierExecution: { upsert },
    }

    await recordTargetedPageVerifierExecutions({
      auditId: 'review-2',
      pageUrl: 'https://example.com',
      primary: true,
      failedModules: ['metadata'],
      flowCompleted: false,
      availableTools: ['html-parse', 'browser-capture'],
    }, db as never)

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'FAILED' }),
    }))
  })

  it('does not certify a PageSpeed verifier when PageSpeed evidence is unavailable', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'execution-1' })
    const db = {
      audit: { findUnique: vi.fn().mockResolvedValue({ parentId: 'review-1' }) },
      improvementAttempt: {
        findMany: vi.fn().mockResolvedValue([{
          improvement: { occurrences: [{ flag: {
            source: 'DETERMINISTIC', checkId: 'mobile-lcp-critical', fingerprint: null,
            pageUrl: 'https://example.com',
          } }] },
        }]),
      },
      auditVerifierExecution: { upsert },
    }

    await recordTargetedPageVerifierExecutions({
      auditId: 'review-2',
      pageUrl: 'https://example.com',
      primary: true,
      failedModules: [],
      flowCompleted: false,
      availableTools: ['html-parse', 'browser-capture'],
    }, db as never)

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'FAILED', evidenceReference: undefined }),
    }))
  })

})
