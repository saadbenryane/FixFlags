import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  auditUpdate: vi.fn(),
  auditUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  mergePrescriptionResults: vi.fn(),
  flagKeyForRow: vi.fn(),
  tryResolveEvidenceAnchorsForAudit: vi.fn(),
  finalizeAudit: vi.fn(),
  loadAuditScreenshotBase64: vi.fn(),
  logPipelineEvent: vi.fn(),
  remainingAiReportCredits: vi.fn(),
  hasUnlimitedScans: vi.fn(),
  runPrescriptionWithRetry: vi.fn(),
  loadTechnologyProfile: vi.fn(),
  technologyNamesForPrompt: vi.fn(),
  executionOwner: vi.fn(),
}))

vi.mock('@/lib/audit/execution-ownership', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/audit/execution-ownership')>(), currentExecutionOwnership: mocks.executionOwner,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.auditFindUnique, update: mocks.auditUpdate,
      updateMany: mocks.auditUpdateMany, findUniqueOrThrow: async () => ({ executionGeneration: 1 }) },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ $queryRaw: async () => [{ id: 'a1', lifecycleStatus: 'ACTIVE', deletedAt: null, cleanup: false }], audit: { update: mocks.auditUpdate } }),
    user: { findUnique: mocks.userFindUnique },
  },
}))

vi.mock('@/lib/audit/persist', () => ({
  mergePrescriptionResults: mocks.mergePrescriptionResults,
  flagKeyForRow: mocks.flagKeyForRow,
}))

vi.mock('@/lib/audit/persist-evidence-anchors', () => ({
  tryResolveEvidenceAnchorsForAudit: mocks.tryResolveEvidenceAnchorsForAudit,
}))

vi.mock('@/lib/audit/finalize', () => ({
  finalizeAudit: mocks.finalizeAudit,
}))

vi.mock('@/lib/audit/load-screenshot-base64', () => ({
  loadAuditScreenshotBase64: mocks.loadAuditScreenshotBase64,
}))

vi.mock('@/lib/audit/pipeline-log', () => ({
  logPipelineEvent: mocks.logPipelineEvent,
}))

vi.mock('@/lib/audit/ai-report-entitlement', () => ({
  remainingAiReportCredits: mocks.remainingAiReportCredits,
}))

vi.mock('@/lib/auth/permissions', () => ({
  hasUnlimitedScans: mocks.hasUnlimitedScans,
}))

vi.mock('@/lib/audit/judge-prescription', () => ({
  runPrescriptionWithRetry: mocks.runPrescriptionWithRetry,
}))

vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: mocks.loadTechnologyProfile,
  technologyNamesForPrompt: mocks.technologyNamesForPrompt,
}))

import { runAiReview } from '../run-ai-review'
import { JudgeContractError } from '../validate-judge-output'
import { mergeSupportingObservations, observationsForFlag } from '../flag-observations'

const AUDIT = {
  id: 'a1',
  url: 'https://example.com',
  status: 'COMPLETED',
  userId: 'user-1',
  triageAt: new Date(),
  aiReviewAt: null,
  verdict: 'Good page, fix the CTA.',
  score: 72,
  htmlMetadata: { title: 'Example' },
  evidenceCoverage: { desktopPageSpeed: true },
  flags: [{ id: 'f1', checkId: 'no-https', source: 'deterministic', rubric: 'REACH', severity: 'CRITICAL', problem: 'No HTTPS', evidence: 'x' }],
  rubrics: [{ id: 'r1', name: 'MESSAGE', grade: 'B', score: 70, summary: 'ok' }],
}

const USER = { id: 'user-1', role: 'USER', plan: 'FREE', auditsUsed: 1, auditsLimit: 3 }

const PRESCRIPTION = {
  output: {
    flags: [{ id: 'x' }],
    rubrics: [],
    verdict: 'v',
    score: 70,
    pageJob: 'j',
    pageType: 'homepage',
    launchReadiness: 'fix_first',
    launchChecklist: [],
  },
  usage: { inputTokens: 10, outputTokens: 5, model: 'gpt-4o-mini' },
}

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.auditFindUnique.mockResolvedValue({ ...AUDIT })
  mocks.executionOwner.mockReturnValue({ auditId: 'a1', taskId: 'prescription-task', token: 'unit-fixture', generation: 1 })
  mocks.auditUpdate.mockResolvedValue({})
  mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
  mocks.userFindUnique.mockResolvedValue({ ...USER })
  mocks.hasUnlimitedScans.mockReturnValue(false)
  mocks.remainingAiReportCredits.mockResolvedValue(2)
  mocks.loadAuditScreenshotBase64.mockResolvedValue({ desktopBase64: 'aGk=', mobileBase64: null })
  mocks.loadTechnologyProfile.mockResolvedValue({})
  mocks.technologyNamesForPrompt.mockReturnValue(['Next.js'])
  mocks.flagKeyForRow.mockReturnValue('key-1')
  mocks.runPrescriptionWithRetry.mockResolvedValue(PRESCRIPTION)
  mocks.mergePrescriptionResults.mockResolvedValue(undefined)
  mocks.tryResolveEvidenceAnchorsForAudit.mockResolvedValue(undefined)
  mocks.finalizeAudit.mockResolvedValue(undefined)
  mocks.logPipelineEvent.mockResolvedValue(undefined)
}

describe('runAiReview', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('sends all original supporting scopes to prescription without private comparison fields or invented grades', async () => {
    const supportingObservations = mergeSupportingObservations([0, 1].map(index => observationsForFlag({
      source: 'DETERMINISTIC', checkId: 'no-https', pageUrl: `https://example.com/page-${index}`, evidence: `Original observation ${index}`,
      evidenceTargets: [{ kind: 'element', source: 'measured', device: index ? 'mobile' : 'desktop', label: 'Original target', context: 'private-context' }],
    }, { auditId: 'private-audit', taskId: 'private-task-' + index, checkVersion: 1 })))
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, flags: [{ ...AUDIT.flags[0], supportingObservations }],
      rubrics: [{ ...AUDIT.rubrics[0], grade: null, score: null }] })
    await runAiReview('a1')
    const context = mocks.runPrescriptionWithRetry.mock.calls[0][0]
    assert.deepEqual(context.existingFlags[0].supportingObservations.map((item: { pageUrl: string }) => item.pageUrl),
      ['https://example.com/page-0', 'https://example.com/page-1'])
    assert.equal(context.rubrics[0].grade, null)
    assert.equal(context.rubrics[0].score, null)
    assert.doesNotMatch(JSON.stringify(context), /private-context|private-audit|private-task/)
  })

  it('refuses an unreadable recorded observation contract before provider generation', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, flags: [{ ...AUDIT.flags[0], supportingObservations: { version: 9, items: [] } }] })
    await assert.rejects(() => runAiReview('a1'), /supporting observations could not be read/)
    assert.equal(mocks.runPrescriptionWithRetry.mock.calls.length, 0)
    assert.equal(mocks.mergePrescriptionResults.mock.calls.length, 0)
  })

  it('throws when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await assert.rejects(() => runAiReview('a1'), /not found/)
  })

  it('refuses execution outside its owning task', async () => {
    for (const owner of [undefined, { auditId: 'other', taskId: 'foreign-task' }, { auditId: 'a1' }]) {
      mocks.executionOwner.mockReturnValue(owner)
      await expect(runAiReview('a1')).rejects.toThrow('requires its execution task')
    }
    expect(mocks.runPrescriptionWithRetry).not.toHaveBeenCalled()
  })

  it('returns early when AI review already ran', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, aiReviewAt: new Date() })
    await runAiReview('a1')
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('throws when triage has not completed', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, triageAt: null })
    await assert.rejects(() => runAiReview('a1'), /has not completed triage/)
  })

  it('throws when the audit is not ready for prescription', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, status: 'CHECKING' })
    await assert.rejects(() => runAiReview('a1'), /not ready for prescription/)
  })

  it('throws when the audit is not claimed', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, userId: null })
    await assert.rejects(() => runAiReview('a1'), /must be claimed/)
  })

  it('throws when the owner is gone', async () => {
    mocks.userFindUnique.mockResolvedValue(null)
    await assert.rejects(() => runAiReview('a1'), /owner not found/)
  })

  it('throws when the AI report limit is reached', async () => {
    mocks.remainingAiReportCredits.mockResolvedValue(0)
    await assert.rejects(() => runAiReview('a1'), /limit reached/)
  })

  it('skips the limit check for unlimited plans', async () => {
    mocks.hasUnlimitedScans.mockReturnValue(true)
    mocks.remainingAiReportCredits.mockResolvedValue(0)
    await runAiReview('a1')
    expect(mocks.finalizeAudit).toHaveBeenCalled()
  })

  it('throws when metadata is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, htmlMetadata: null })
    await assert.rejects(() => runAiReview('a1'), /metadata missing/)
  })

  it('uses observed prose for prescription without replacing stored HTML declarations', async () => {
    const htmlMetadata = { title: 'Recorded page', pageText: 'Lorem ipsum hidden copy', h1s: ['Your Company Name'], h2s: [],
      renderedCopy: { version: 1, pageUrl: AUDIT.url, pageText: 'Plan useful projects for your team.', h1s: ['Plan useful team projects'],
        h2s: [], complete: true, textTruncated: false } }
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, htmlMetadata })
    await runAiReview('a1')
    expect(mocks.runPrescriptionWithRetry.mock.calls[0][0].metadata).toMatchObject({ pageText: htmlMetadata.renderedCopy.pageText,
      h1s: htmlMetadata.renderedCopy.h1s })
    expect(htmlMetadata.pageText).toBe('Lorem ipsum hidden copy')
  })

  it('does not send unobserved rendered prose to prescription', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, htmlMetadata: { title: 'Recorded page', renderedCopy: null } })
    await expect(runAiReview('a1')).rejects.toThrow('Rendered page copy could not be observed')
    expect(mocks.runPrescriptionWithRetry).not.toHaveBeenCalled()
  })

  it('throws when the verdict is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, verdict: null })
    await assert.rejects(() => runAiReview('a1'), /verdict missing/)
  })

  it('throws when the desktop screenshot is missing', async () => {
    mocks.loadAuditScreenshotBase64.mockResolvedValue({ desktopBase64: null, mobileBase64: null })
    await assert.rejects(() => runAiReview('a1'), /Desktop screenshot missing/)
  })

  it('runs prescription and finalizes on success', async () => {
    await runAiReview('a1')
    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { includeAi: true },
    })
    expect(mocks.mergePrescriptionResults).toHaveBeenCalledWith('a1', PRESCRIPTION.output)
    expect(mocks.finalizeAudit).toHaveBeenCalledWith(expect.objectContaining({ auditId: 'a1' }))
  })

  it.each([null, {}, { desktopPageSpeed: true }])('preserves missing observations during prescription completion: %j', async evidenceCoverage => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT, evidenceCoverage, flowData: {} })
    await runAiReview('a1')
    expect(mocks.finalizeAudit).toHaveBeenCalledWith(expect.objectContaining({ evidence: expect.objectContaining({
      desktopPageSpeed: evidenceCoverage?.desktopPageSpeed === true,
      mobilePageSpeed: false,
      flowScan: false,
    }) }))
  })

  it('records AI_REVIEW_FAILED and rethrows on prescription errors', async () => {
    mocks.runPrescriptionWithRetry.mockRejectedValue(new Error('provider exploded'))
    await assert.rejects(() => runAiReview('a1'), /provider exploded/)
    const update = mocks.auditUpdate.mock.calls[1][0]
    expect(update.data.failureCode).toBe('AI_REVIEW_FAILED')
    expect(update.data.status).toBe('COMPLETED')
    expect(update.data.progress).toBe(100)
  })

  it('records AI_CONTRACT_INVALID for contract errors', async () => {
    mocks.runPrescriptionWithRetry.mockRejectedValue(new JudgeContractError('bad schema'))
    await assert.rejects(() => runAiReview('a1'), /bad schema/)
    const update = mocks.auditUpdate.mock.calls[1][0]
    expect(update.data.failureCode).toBe('AI_CONTRACT_INVALID')
  })
})

import { expect } from 'vitest'
void expect
