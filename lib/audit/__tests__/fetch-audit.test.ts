import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getSession: vi.fn(),
  cookies: vi.fn(),
  headers: vi.fn(),
  resolveAuditAccess: vi.fn(),
  resolveReportTierForAudit: vi.fn(),
  canViewPrescription: vi.fn(),
  canViewDeterministic: vi.fn(),
  loadTechnologyProfile: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { audit: { findUnique: mocks.findUnique } },
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

vi.mock('@/lib/auth/entitlements', () => ({
  resolveReportTierForAudit: mocks.resolveReportTierForAudit,
}))

vi.mock('@/lib/audit/report-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/report-access')>()
  return {
    ...actual,
    canViewPrescriptionContentForAudit: mocks.canViewPrescription,
    canViewDeterministicFixesForAudit: mocks.canViewDeterministic,
  }
})

vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: mocks.loadTechnologyProfile,
}))

import {
  stripInternalAuditFields,
  redactCompletedPrivateReportData,
  resolveIsPaidForAudit,
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
  mocks.resolveReportTierForAudit.mockResolvedValue('free')
  mocks.canViewPrescription.mockResolvedValue(true)
  mocks.canViewDeterministic.mockResolvedValue(true)
  mocks.loadTechnologyProfile.mockResolvedValue({})
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

describe('resolveIsPaidForAudit', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('is true when the report tier is paid', async () => {
    mocks.resolveReportTierForAudit.mockResolvedValue('paid')
    assert.equal(await resolveIsPaidForAudit({ userId: 'u1', isPublic: false }), true)
  })

  it('is false for free tiers', async () => {
    mocks.resolveReportTierForAudit.mockResolvedValue('free')
    assert.equal(await resolveIsPaidForAudit({ userId: null, isPublic: true }), false)
  })
})

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
    mocks.resolveAuditAccess.mockResolvedValue('viewer')
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
    pipelineLog: null,
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

  it('strips prescription content when access cannot view prompts', async () => {
    mocks.resolveAuditAccess.mockResolvedValue('viewer')
    mocks.canViewPrescription.mockResolvedValue(false)
    mocks.canViewDeterministic.mockResolvedValue(false)
    mocks.findUnique.mockResolvedValue(fullRow)
    const result = await getGatedAuditForRequest('a1')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.showPrescription, false)
      assert.equal(result.showDeterministicFixes, false)
    }
  })
})

import { expect } from 'vitest'
void expect
