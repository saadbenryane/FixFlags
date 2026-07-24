import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, prismaMock } = vi.hoisted(() => {
  const transactionClient = {
    auditTechnologyObservation: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    technology: {
      upsert: vi.fn(),
    },
    audit: {
      update: vi.fn(),
    },
  }
  return {
    tx: transactionClient,
    prismaMock: {
      $transaction: vi.fn(async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)
      ),
      audit: {
        findUnique: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  loadTechnologyProfile,
  persistTechnologyObservations,
} from '@/lib/audit/technology-profile'

describe('technology profile persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.technology.upsert.mockResolvedValue({ id: 'tech_1' })
  })

  it('replaces an audit snapshot idempotently and stores sanitized evidence', async () => {
    await persistTechnologyObservations(
      'audit_1',
      [{
        name: 'Next.js',
        kind: 'framework',
        confidence: 0.95,
        evidence: [{ type: 'resource', label: 'Next.js assets under /_next/' }],
      }],
      'COMPLETE'
    )

    expect(tx.auditTechnologyObservation.deleteMany).toHaveBeenCalledWith({
      where: { auditId: 'audit_1' },
    })
    expect(tx.technology.upsert).toHaveBeenCalledWith({
      where: { name: 'Next.js' },
      create: { name: 'Next.js', kind: 'framework' },
      update: { kind: 'framework' },
    })
    expect(tx.auditTechnologyObservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        auditId: 'audit_1',
        technologyId: 'tech_1',
        confidence: 0.95,
        evidence: [{ type: 'resource', label: 'Next.js assets under /_next/' }],
      }),
    })
    expect(tx.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit_1' },
      data: expect.objectContaining({
        technologyDetectionStatus: 'COMPLETE',
      }),
    })
  })

  it('computes stack changes only for matching detector versions', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce({
        parentId: 'audit_parent',
        technologyDetectionStatus: 'COMPLETE',
        technologyDetectorVersion: 'same-version',
        technologyDetectedAt: new Date('2026-07-23T10:00:00Z'),
        technologyObservations: [
          {
            confidence: 0.95,
            evidence: [{ type: 'header', label: 'Vercel response header' }],
            technology: { name: 'Vercel', kind: 'hosting' },
          },
          {
            confidence: 0.85,
            evidence: [{ type: 'resource', label: 'Plausible analytics script' }],
            technology: { name: 'Plausible', kind: 'analytics' },
          },
        ],
      })
      .mockResolvedValueOnce({
        technologyDetectorVersion: 'same-version',
        technologyDetectionStatus: 'COMPLETE',
        technologyObservations: [
          { confidence: 0.95, technology: { name: 'Next.js' } },
          { confidence: 0.95, technology: { name: 'Plausible' } },
        ],
      })

    const result = await loadTechnologyProfile('audit_current', {
      score: 72,
      rubrics: [{ name: 'Experience', score: 68 }],
      flags: [{ rubric: 'Experience', status: 'NEW' }],
    })

    expect(result.recheckDiff).toEqual({
      added: ['Vercel'],
      removed: ['Next.js'],
      confidenceChanged: ['Plausible'],
    })
    expect(result.insight).toContain('Experience is the lowest-scoring rubric at 68')
  })

  it('suppresses a re-check diff when the detector version changed', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce({
        parentId: 'audit_parent',
        technologyDetectionStatus: 'COMPLETE',
        technologyDetectorVersion: 'new-version',
        technologyDetectedAt: new Date(),
        technologyObservations: [{
          confidence: 0.95,
          evidence: [],
          technology: { name: 'Vercel', kind: 'hosting' },
        }],
      })
      .mockResolvedValueOnce({
        technologyDetectorVersion: 'old-version',
        technologyDetectionStatus: 'COMPLETE',
        technologyObservations: [],
      })

    expect((await loadTechnologyProfile('audit_current')).recheckDiff).toBeUndefined()
  })
})
