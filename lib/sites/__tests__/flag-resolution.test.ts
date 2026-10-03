import { describe, expect, it } from 'vitest'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { flagResolutionView, siteFlagDetailStatus, type FlagResolutionInput } from '@/lib/sites/flag-resolution'

const PROOF_AT = '2026-09-20T17:58:10.414Z'

function input(overrides: Partial<FlagResolutionInput> = {}): FlagResolutionInput {
  return {
    status: 'OPEN',
    resolvedInId: null,
    sourceAuditId: 'audit-source',
    verifying: false,
    proof: null,
    ...overrides,
  }
}

function completedProof(overrides: Partial<NonNullable<FlagResolutionInput['proof']>> = {}) {
  return {
    id: 'audit-proof',
    status: 'COMPLETED',
    completedAt: PROOF_AT,
    createdAt: '2026-09-20T17:00:00.000Z',
    ...overrides,
  }
}

describe('flagResolutionView', () => {
  it('keeps an open Flag as needing a fix', () => {
    const view = flagResolutionView(input())
    expect(view.kind).toBe('open')
    expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagStatus)
  })

  it('says Recovered for the improvement status the Flag detail page loads', () => {
    for (const improvementStatus of ['PROPOSED', 'VERIFIED']) {
      const status = siteFlagDetailStatus(improvementStatus, 'FIXED')
      const view = flagResolutionView(input({
        status,
        resolvedInId: 'audit-proof',
        proof: completedProof(),
      }))
      expect(status).toBe(improvementStatus)
      expect(view.kind).toBe('proven')
      if (view.kind !== 'proven') continue
      expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagRecovered)
      expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
      expect(view.proof.observedAt).toBe(PROOF_AT)
      expect(view.proof.observation).toBe(SITE_BOARD_COPY.flagProofObserved)
    }
  })

  it('keeps that dated check visible while the loaded status is being verified again', () => {
    for (const improvementStatus of ['PROPOSED', 'VERIFIED']) {
      const view = flagResolutionView(input({
        status: siteFlagDetailStatus(improvementStatus, 'FIXED'),
        resolvedInId: 'audit-proof',
        verifying: true,
        proof: completedProof(),
      }))
      expect(view.kind).toBe('verifying')
      if (view.kind !== 'verifying') continue
      expect(view.statusLabel).toBe(SITE_BOARD_COPY.verifying)
      expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
      expect(view.proof?.observedAt).toBe(PROOF_AT)
      expect(view.proof?.observation).toBe(SITE_BOARD_COPY.flagProofObserved)
    }
  })

  it('says Couldn’t verify when the loaded status recorded a proof the page cannot show', () => {
    const view = flagResolutionView(input({
      status: siteFlagDetailStatus('PROPOSED', 'FIXED'),
      resolvedInId: 'audit-proof',
      proof: null,
    }))
    expect(view.kind).toBe('unproven')
    if (view.kind !== 'unproven') return
    expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagProofMissing)
    expect(view.nextStep).toBe('verify')
    expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
  })

  it('says Recovered only for the completed proof audit this Flag recorded', () => {
    const view = flagResolutionView(input({
      status: 'FIXED',
      resolvedInId: 'audit-proof',
      proof: completedProof(),
    }))
    expect(view.kind).toBe('proven')
    if (view.kind !== 'proven') return
    expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagRecovered)
    expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
    expect(view.proof.observedAt).toBe(PROOF_AT)
    expect(view.proof.observation).toBe(SITE_BOARD_COPY.flagProofObserved)
    expect(view.proof.showAuditId).toBe(true)
    expect(view.proof.auditId).toBe('audit-proof')
  })

  it('hides the proof id when the recovering check is the Flag source', () => {
    const view = flagResolutionView(input({
      status: 'FIXED',
      resolvedInId: 'audit-source',
      sourceAuditId: 'audit-source',
      proof: completedProof({ id: 'audit-source' }),
    }))
    expect(view.kind).toBe('proven')
    if (view.kind !== 'proven') return
    expect(view.proof.showAuditId).toBe(false)
  })

  it('uses the created time when the completed check has no completion timestamp', () => {
    const view = flagResolutionView(input({
      status: 'FIXED',
      resolvedInId: 'audit-proof',
      proof: completedProof({ completedAt: null, createdAt: '2026-09-21T08:00:00.000Z' }),
    }))
    expect(view.kind).toBe('proven')
    if (view.kind !== 'proven') return
    expect(view.proof.observedAt).toBe('2026-09-21T08:00:00.000Z')
  })

  it('does not call a fixed Flag recovered when the proof check is missing, unfinished, or someone else', () => {
    const cases = [
      input({ status: 'FIXED', resolvedInId: 'audit-proof', proof: null }),
      input({ status: 'FIXED', resolvedInId: null, proof: completedProof() }),
      input({
        status: 'FIXED',
        resolvedInId: 'audit-proof',
        proof: completedProof({ status: 'FAILED' }),
      }),
      input({
        status: 'FIXED',
        resolvedInId: 'audit-proof',
        proof: completedProof({ status: 'RUNNING' }),
      }),
      input({
        status: 'FIXED',
        resolvedInId: 'audit-proof',
        proof: completedProof({ id: 'audit-other' }),
      }),
      input({
        status: 'FIXED',
        resolvedInId: 'audit-proof',
        proof: completedProof({ completedAt: null, createdAt: null }),
      }),
      input({
        status: 'FIXED',
        resolvedInId: 'audit-proof',
        proof: completedProof({ completedAt: 'not-a-date', createdAt: null }),
      }),
    ]
    for (const entry of cases) {
      const view = flagResolutionView(entry)
      expect(view.kind).toBe('unproven')
      if (view.kind !== 'unproven') continue
      expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagProofMissing)
      expect(view.body).toBe(SITE_BOARD_COPY.flagProofMissingBody)
      expect(view.nextStep).toBe('verify')
      expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagRecovered)
      expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
      expect(view.statusLabel).not.toBe(SITE_BOARD_COPY.verifying)
    }
  })

  it('says Verifying only while an attempt is still open, and keeps the last proof as history', () => {
    const running = flagResolutionView(input({
      status: 'FIXED',
      resolvedInId: 'audit-proof',
      verifying: true,
      proof: completedProof(),
    }))
    expect(running.kind).toBe('verifying')
    if (running.kind !== 'verifying') return
    expect(running.statusLabel).toBe(SITE_BOARD_COPY.verifying)
    expect(running.proof?.observation).toBe(SITE_BOARD_COPY.flagProofObserved)
    expect(running.runningNote).toBe(SITE_BOARD_COPY.flagProofRunning)

    const openRun = flagResolutionView(input({ status: 'OPEN', verifying: true }))
    expect(openRun.kind).toBe('verifying')
    if (openRun.kind !== 'verifying') return
    expect(openRun.proof).toBeNull()
    expect(openRun.statusLabel).not.toBe(SITE_BOARD_COPY.flagStatus)
  })

  it('leaves a proposed improvement with no recorded proof as needing a fix', () => {
    const view = flagResolutionView(input({
      status: siteFlagDetailStatus('PROPOSED', 'OPEN'),
      resolvedInId: null,
      proof: completedProof(),
    }))
    expect(view.kind).toBe('open')
    expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagStatus)
  })

  it('does not treat a proof object as recovery while the Flag is still open', () => {
    const view = flagResolutionView(input({
      status: 'OPEN',
      resolvedInId: 'audit-proof',
      proof: completedProof(),
    }))
    expect(view.kind).toBe('open')
    expect(view.statusLabel).toBe(SITE_BOARD_COPY.flagStatus)
  })
})
