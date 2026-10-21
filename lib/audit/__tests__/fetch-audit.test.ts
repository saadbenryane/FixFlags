import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  getSession: vi.fn(),
  cookies: vi.fn(),
  headers: vi.fn(),
  resolveAuditAccess: vi.fn(),
  loadTechnologyProfile: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { audit: { findUnique: mocks.findUnique, findFirst: mocks.findFirst } },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}))

vi.mock('@/lib/audit/access', () => ({
  resolveAuditAccess: mocks.resolveAuditAccess,
}))

vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: mocks.loadTechnologyProfile,
}))

import {
  stripInternalAuditFields,
  redactCompletedPrivateReportData,
  resolveActiveAttachedWorkId,
  getProgressiveAuditForRequest,
  getGatedAuditForRequest,
} from '../fetch-audit'

const SESSION = { user: { id: 'user-1', email: 'a@b.com' } }

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.getSession.mockResolvedValue(SESSION)
  mocks.headers.mockResolvedValue(new Headers())
  mocks.cookies.mockReturnValue({ get: () => undefined })
  mocks.resolveAuditAccess.mockResolvedValue('owner')
  mocks.loadTechnologyProfile.mockResolvedValue({})
  mocks.findFirst.mockResolvedValue(null)
}

describe('stripInternalAuditFields', () => {
  it('removes internal blobs and keeps public fields', () => {
    const input = {
      id: 'a1',
      url: 'https://example.com',
      score: 72,
      htmlMetadata: { big: 'blob' },
      performanceData: { more: 'blob' },
      consoleErrors: [],
      scanAccessEncrypted: 'enc',
      gclid: 'x',
      fbclid: 'y',
      leadSyncedAt: new Date(),
      referrer: 'ref',
      utmSource: 's',
      utmMedium: 'm',
      utmCampaign: 'c',
      failureMetadata: { source: 'x' },
      verdict: 'keep me',
    }
    const out = stripInternalAuditFields(input)
    assert.equal(out.id, 'a1')
    assert.equal(out.verdict, 'keep me')
    assert.equal('htmlMetadata' in out, false)
    assert.equal('performanceData' in out, false)
    assert.equal('scanAccessEncrypted' in out, false)
    assert.equal('gclid' in out, false)
    assert.equal('failureMetadata' in out, false)
  })
})

describe('redactCompletedPrivateReportData', () => {
  const input = {
    project: { id: 'p1' },
    pages: [{ id: 'pg1' }],
    journeyReviews: [{ id: 'j1' }],
    pipelineLog: [{ id: 'l1' }],
    watchInterval: 'weekly' as const,
    triageAt: new Date(),
    flowData: { x: 1 },
    actionTimeline: [{ label: 'x' }],
    productContract: { purpose: 'p' },
  }

  it('returns the input unchanged when access is allowed', () => {
    assert.equal(redactCompletedPrivateReportData(input, true), input)
  })

  it('redacts private data when access is denied', () => {
    const out = redactCompletedPrivateReportData(input, false)
    assert.equal(out.project, null)
    assert.deepEqual(out.pages, [])
    assert.deepEqual(out.journeyReviews, [])
    assert.deepEqual(out.pipelineLog, [])
    assert.equal(out.watchInterval, null)
    assert.equal(out.triageAt, null)
    assert.equal(out.flowData, null)
    assert.deepEqual(out.actionTimeline, [])
    assert.equal(out.productContract, null)
  })
})

describe('resolveActiveAttachedWorkId', () => {
  beforeEach(() => {
    resetMocks()
    mocks.findUnique.mockResolvedValue({ id: 'parent-1', userId: 'user-1', isPublic: false })
  })
  afterEach(() => vi.restoreAllMocks())

  it('stays on the requested id when there is no attached child', async () => {
    assert.equal(await resolveActiveAttachedWorkId('parent-1'), 'parent-1')
    expectFindFirstActiveChild('parent-1')
  })

  it('follows an in-flight attached Update review', async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: 'child-active' })
    assert.equal(await resolveActiveAttachedWorkId('parent-1'), 'child-active')
  })

  it('does not hop to a completed child', async () => {
    mocks.findFirst.mockResolvedValueOnce(null)
    assert.equal(await resolveActiveAttachedWorkId('parent-1'), 'parent-1')
    expectFindFirstActiveChild('parent-1')
  })

  it('does not reveal attached work through a denied parent', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('denied')
    mocks.findFirst.mockResolvedValueOnce({ id: 'private-child', userId: 'another-user', isPublic: false })
    assert.equal(await resolveActiveAttachedWorkId('parent-1'), 'parent-1')
    assert.equal(mocks.findFirst.mock.calls.length, 0)
  })

  it('does not borrow public parent access for a private child', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'parent-1', userId: null, isPublic: true })
    mocks.findFirst.mockResolvedValueOnce({ id: 'private-child', userId: 'another-user', isPublic: false })
    mocks.resolveAuditAccess.mockImplementation(async audit => audit.id === 'parent-1' ? 'public_viewer' : 'denied')
    assert.equal(await resolveActiveAttachedWorkId('parent-1'), 'parent-1')
  })
})

function expectFindFirstActiveChild(parentId: string) {
  assert.deepEqual(mocks.findFirst.mock.calls[0]?.[0], {
    where: {
      parentId,
      status: {
        in: ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING'],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, userId: true, isPublic: true },
  })
}

describe('getProgressiveAuditForRequest', () => {
  const row = {
    id: 'a1',
    url: 'https://example.com',
    status: 'CHECKING',
    score: null,
    verdict: null,
    userId: 'user-1',
    isPublic: false,
    flags: [],
    screenshots: [],
    performanceData: null,
    productContract: null,
    progress: 40,
    updatedAt: new Date(),
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns not_found for unknown audits', async () => {
    mocks.findUnique.mockResolvedValue(null)
    assert.deepEqual(await getProgressiveAuditForRequest('a1'), { kind: 'not_found' })
  })

  it('returns forbidden when access is denied', async () => {
    mocks.findUnique.mockResolvedValue(row)
    mocks.resolveAuditAccess.mockResolvedValue('denied')
    assert.deepEqual(await getProgressiveAuditForRequest('a1'), { kind: 'forbidden' })
  })

  it('returns a completed envelope for finished audits', async () => {
    mocks.findUnique.mockResolvedValue({
      ...row,
      status: 'COMPLETED',
      score: 81,
      verdict: 'Good page',
      flags: [
        { severity: 'CRITICAL', problem: 'No HTTPS' },
        { severity: 'IMPORTANT', problem: 'Slow LCP' },
      ],
    })
    const result = await getProgressiveAuditForRequest('a1')
    assert.equal(result.kind, 'completed')
    if (result.kind === 'completed') {
      assert.equal(result.audit.score, 81)
      assert.equal(result.audit.flags.length, 2)
      assert.equal(result.audit.flags[0].severity, 'CRITICAL')
    }
  })

  it('exposes private fields only to owners in progressive mode', async () => {
    mocks.findUnique.mockResolvedValue({
      ...row,
      performanceData: {
        actionTimeline: [{ label: 'navigate' }],
        screenshots: { desktop: 'ok', mobile: 'pending' },
      },
      productContract: {
        purpose: 'Sell widgets',
        firstValueJourney: 'Sign up',
        criticalOutcomes: ['buy'],
      },
    })
    const result = await getProgressiveAuditForRequest('a1')
    assert.equal(result.kind, 'progressive')
    if (result.kind === 'progressive') {
      assert.equal(result.audit.screenshotCapture.desktop, 'ok')
      assert.equal(result.audit.actionTimeline.length, 1)
      assert.equal(result.audit.productContract?.purpose, 'Sell widgets')
    }
  })

  it('hides private fields from non-owners', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('public_viewer')
    mocks.findUnique.mockResolvedValue({
      ...row,
      performanceData: {
        actionTimeline: [{ label: 'navigate' }],
        screenshots: { desktop: 'failed' },
      },
      productContract: {
        purpose: 'Sell widgets',
        firstValueJourney: 'Sign up',
        criticalOutcomes: ['buy'],
      },
    })
    const result = await getProgressiveAuditForRequest('a1')
    assert.equal(result.kind, 'progressive')
    if (result.kind === 'progressive') {
      assert.deepEqual(result.audit.actionTimeline, [])
      assert.equal(result.audit.productContract, null)
      assert.equal(result.audit.screenshotCapture.desktop, 'failed')
    }
  })

  it('uses the selected child access when projecting progressive data', async () => {
    mocks.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, id: 'child-public',
      userId: 'another-user', isPublic: true,
      performanceData: { actionTimeline: [{ label: 'private child context' }] },
      productContract: { purpose: 'Private child purpose', firstValueJourney: 'Sign up', criticalOutcomes: ['buy'] } })
    mocks.findFirst.mockResolvedValueOnce({ id: 'child-public', userId: 'another-user', isPublic: true })
    mocks.resolveAuditAccess.mockImplementation(async audit => audit.id === 'a1' ? 'owner' : 'public_viewer')
    const result = await getProgressiveAuditForRequest('a1')
    assert.equal(result.kind, 'progressive')
    if (result.kind === 'progressive') {
      assert.equal(result.accessContext, 'public_viewer')
      assert.equal(result.capabilities.canViewPrivateProductContext, false)
      assert.deepEqual(result.audit.actionTimeline, [])
      assert.equal(result.audit.productContract, null)
    }
  })

  it('derives pending capture state for queued audits without stored state', async () => {
    mocks.findUnique.mockResolvedValue({ ...row, status: 'QUEUED', screenshots: [] })
    const result = await getProgressiveAuditForRequest('a1')
    if (result.kind === 'progressive') {
      assert.deepEqual(result.audit.screenshotCapture, { desktop: 'pending', mobile: 'pending' })
    }
  })
})

describe('getGatedAuditForRequest', () => {
  const fullRow = {
    id: 'a1',
    url: 'https://example.com',
    status: 'COMPLETED',
    score: 81,
    verdict: 'Good page',
    userId: 'user-1',
    isPublic: false,
    triageAt: new Date(),
    aiReviewAt: new Date(),
    includeAi: true,
    failureCode: null,
    launchReadiness: 'fix_first',
    htmlMetadata: null,
    performanceData: null,
    flowData: null,
    productContract: null,
    pipelineEvents: [],
    flags: [],
    rubrics: [
      {
        id: 'r1',
        name: 'MESSAGE',
        grade: 'B',
        score: 70,
        status: 'GOOD',
        summary: 'Solid message',
        rubricPrompt: null,
        flags: [],
      },
    ],
    pages: [],
    journeyReviews: [],
    screenshots: [],
    project: { productIntelligence: null, watchInterval: null },
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns not_found for unknown audits', async () => {
    mocks.findUnique.mockResolvedValue(null)
    assert.deepEqual(await getGatedAuditForRequest('a1'), { kind: 'not_found' })
  })

  it('returns forbidden when access is denied', async () => {
    mocks.findUnique.mockResolvedValue(fullRow)
    mocks.resolveAuditAccess.mockResolvedValue('denied')
    assert.deepEqual(await getGatedAuditForRequest('a1'), { kind: 'forbidden' })
  })

  it.each(['AI_REVIEW_FAILED', 'AI_CONTRACT_INVALID'])('shows a terminal prescription failure instead of indefinite pending: %s', async failureCode => {
    mocks.findUnique.mockResolvedValue({ ...fullRow, aiReviewAt: null, failureCode, reportCompleteness: 'PARTIAL',
      evidenceCoverage: { metadata: false, aiAssessment: false } })
    const result = await getGatedAuditForRequest('a1')
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result).toMatchObject({ aiReviewPending: false, prescriptionFailed: true, showPrescription: false })
      expect(result.audit).toMatchObject({ reportCompleteness: 'PARTIAL', evidenceCoverage: { metadata: false, aiAssessment: false } })
    }
  })

  it('keeps a prescription awaiting bounded input recovery pending', async () => {
    mocks.findUnique.mockResolvedValue({ ...fullRow, aiReviewAt: null, failureCode: null, reportCompleteness: 'PARTIAL' })
    const result = await getGatedAuditForRequest('a1')
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result).toMatchObject({ aiReviewPending: true, prescriptionFailed: false })
  })

  it('returns a full gated report for the owner', async () => {
    mocks.findUnique.mockResolvedValue(fullRow)
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.audit.url, 'https://example.com')
      assert.equal(result.audit.rubrics.length, 3)
      assert.equal(result.audit.flags.length, 0)
      assert.equal(result.accessContext, 'owner')
      assert.equal(result.showPrescription, true)
      assert.equal(result.showDeterministicFixes, true)
    }
  })

  it('does not carry parent prompt privileges into a public child', async () => {
    mocks.findUnique.mockResolvedValueOnce(fullRow).mockResolvedValueOnce({ ...fullRow, id: 'child-public',
      userId: 'another-user', isPublic: true })
    mocks.findFirst.mockResolvedValueOnce({ id: 'child-public', userId: 'another-user', isPublic: true })
    mocks.resolveAuditAccess.mockImplementation(async audit => audit.id === 'a1' ? 'owner' : 'public_viewer')
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.accessContext, 'public_viewer')
      assert.equal(result.showPrescription, false)
      assert.equal(result.showDeterministicFixes, false)
    }
  })

  it('strips prescription content when access cannot view prompts', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('public_viewer')
    mocks.findUnique.mockResolvedValue(fullRow)
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.showPrescription, false)
      assert.equal(result.showDeterministicFixes, false)
    }
  })

  it('removes nested private observations from deterministic reports without triage for non-owners', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('public_viewer')
    const flag = { id: 'f1', source: 'DETERMINISTIC', rubric: 'MESSAGE', severity: 'IMPORTANT', problem: 'Original observation', evidence: 'Public-safe evidence', fix: 'Retained legacy fix', supportingObservations: { version: 1, items: [{ verificationRule: 'PRIVATE_RULE', evidenceTargets: [{ context: 'PRIVATE_CONTEXT' }], provenance: { taskId: 'PRIVATE_TASK' } }] } }
    mocks.findUnique.mockResolvedValue({ ...fullRow, triageAt: null, aiReviewAt: null, includeAi: false, flags: [flag], rubrics: [{ ...fullRow.rubrics[0], flags: [flag] }] })
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.audit.flags[0].supportingObservations, null)
      assert.equal('supportingObservations' in result.audit.rubricRows[0].flags[0], false)
      assert.equal(result.audit.flags[0].evidence, 'Public-safe evidence')
      assert.doesNotMatch(JSON.stringify(result.audit), /PRIVATE_RULE|PRIVATE_CONTEXT|PRIVATE_TASK/)
    }
  })

  it('retains original supporting observations for the owner of a deterministic report', async () => {
    const supportingObservations = { version: 1, items: [{ provenance: { taskId: 'owned-source' }, evidenceTargets: [{ context: 'owned-comparison' }] }] }
    mocks.findUnique.mockResolvedValue({ ...fullRow, triageAt: null, aiReviewAt: null, includeAi: false,
      flags: [{ id: 'owned-flag', source: 'DETERMINISTIC', rubric: 'MESSAGE', severity: 'POLISH', problem: 'Observed copy', evidence: 'Recorded copy', supportingObservations }] })
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') assert.deepEqual(result.audit.flags[0].supportingObservations, supportingObservations)
  })

  it('never projects prompt access into a live public report', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('public_viewer')
    mocks.findUnique.mockResolvedValue(fullRow)

    const result = await getGatedAuditForRequest('a1')

    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.showPrescription, false)
      assert.equal(result.showDeterministicFixes, false)
      assert.equal(result.sampleFixFlag, null)
    }
  })
})

import { expect } from 'vitest'
void expect
