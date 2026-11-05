import { describe, expect, it, vi } from 'vitest'
import { recordVerifierExecution } from './verifier-provenance'

describe('verifier execution provenance', () => {
  it('persists the exact check and normalized page scope idempotently', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'execution-1' })
    await recordVerifierExecution({
      auditId: 'review-2',
      source: 'DETERMINISTIC',
      checkId: 'cta-dead-link::page:2',
      pageUrl: 'https://example.com/#pricing',
      status: 'COMPLETED',
      evidenceReference: { run: 'checker-run-1' },
    }, { auditVerificationReceipt: { upsert } } as never)

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

})
