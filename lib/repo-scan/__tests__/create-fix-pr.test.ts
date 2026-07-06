import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach } from 'vitest'

const mockFindingFindUnique = vi.fn()
const mockFixPrCreate = vi.fn()
const mockFixPrUpdate = vi.fn()
const mockQueueAdd = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    repoScanFinding: {
      findUnique: (...args: unknown[]) => mockFindingFindUnique(...args),
    },
    repoFixPr: {
      create: (...args: unknown[]) => mockFixPrCreate(...args),
      update: (...args: unknown[]) => mockFixPrUpdate(...args),
    },
  },
}))

vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => ({ add: (...args: unknown[]) => mockQueueAdd(...args) }),
}))

import { createAndEnqueueFixPr, RepoFixPrRequestError } from '@/lib/repo-scan/create-fix-pr'

const baseFinding = {
  id: 'finding-1',
  repoScanId: 'scan-1',
  severity: 'CRITICAL',
  category: 'Exposed secret',
  filePath: '.env',
  lineStart: 1,
  lineEnd: 1,
  problem: 'Possible API key committed',
  evidence: 'API_KEY=...',
  fix: 'Rotate the key',
  fixPr: null,
  repoScan: {
    userId: 'user-1',
    repoFullName: 'acme/app',
    status: 'COMPLETED',
    commitSha: 'abc123',
    githubConnection: {
      revokedAt: null,
      selectedRepos: ['acme/app'],
    },
  },
}

beforeEach(() => {
  mockFindingFindUnique.mockReset()
  mockFixPrCreate.mockReset()
  mockFixPrUpdate.mockReset()
  mockQueueAdd.mockReset()
  mockFixPrCreate.mockResolvedValue({ id: 'fixpr-1' })
})

describe('createAndEnqueueFixPr', () => {
  it('throws SCAN_NOT_READY when the finding does not belong to the caller', async () => {
    mockFindingFindUnique.mockResolvedValueOnce({
      ...baseFinding,
      repoScan: { ...baseFinding.repoScan, userId: 'someone-else' },
    })
    await assert.rejects(
      createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'),
      (err: unknown) => err instanceof RepoFixPrRequestError && err.code === 'SCAN_NOT_READY'
    )
  })

  it('throws ALREADY_EXISTS when a fix PR already exists for this finding', async () => {
    mockFindingFindUnique.mockResolvedValueOnce({ ...baseFinding, fixPr: { id: 'existing' } })
    await assert.rejects(
      createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'),
      (err: unknown) => err instanceof RepoFixPrRequestError && err.code === 'ALREADY_EXISTS'
    )
  })

  it('throws SCAN_NOT_READY when the scan has not completed', async () => {
    mockFindingFindUnique.mockResolvedValueOnce({
      ...baseFinding,
      repoScan: { ...baseFinding.repoScan, status: 'SCANNING', commitSha: null },
    })
    await assert.rejects(
      createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'),
      (err: unknown) => err instanceof RepoFixPrRequestError && err.code === 'SCAN_NOT_READY'
    )
  })

  it('throws NOT_CONNECTED when the GitHub connection is revoked', async () => {
    mockFindingFindUnique.mockResolvedValueOnce({
      ...baseFinding,
      repoScan: {
        ...baseFinding.repoScan,
        githubConnection: { revokedAt: new Date(), selectedRepos: ['acme/app'] },
      },
    })
    await assert.rejects(
      createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'),
      (err: unknown) => err instanceof RepoFixPrRequestError && err.code === 'NOT_CONNECTED'
    )
  })

  it('throws REPO_NOT_ALLOWED when the repo is not allow-listed', async () => {
    mockFindingFindUnique.mockResolvedValueOnce({
      ...baseFinding,
      repoScan: {
        ...baseFinding.repoScan,
        githubConnection: { revokedAt: null, selectedRepos: ['someone/other'] },
      },
    })
    await assert.rejects(
      createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'),
      (err: unknown) => err instanceof RepoFixPrRequestError && err.code === 'REPO_NOT_ALLOWED'
    )
  })

  it('creates a DRAFT row and enqueues a repo-fix-pr job on the happy path', async () => {
    mockFindingFindUnique.mockResolvedValueOnce(baseFinding)

    const result = await createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1')

    assert.equal(result.repoFixPrId, 'fixpr-1')
    assert.equal(mockFixPrCreate.mock.calls.length, 1)
    const createArgs = mockFixPrCreate.mock.calls[0][0]
    assert.equal(createArgs.data.status, 'DRAFT')
    assert.equal(createArgs.data.baseSha, 'abc123')
    assert.match(createArgs.data.branchName, /^fixflags\//)

    assert.equal(mockQueueAdd.mock.calls.length, 1)
    const [jobName, jobData, jobOpts] = mockQueueAdd.mock.calls[0]
    assert.equal(jobName, 'repo-fix-pr')
    assert.equal(jobData.repoFixPrId, 'fixpr-1')
    assert.equal(jobOpts.jobId, 'fixpr-1')
    assert.equal(jobOpts.attempts, 1)
  })

  it('marks the row FAILED if enqueueing throws', async () => {
    mockFindingFindUnique.mockResolvedValueOnce(baseFinding)
    mockQueueAdd.mockRejectedValueOnce(new Error('queue down'))

    await assert.rejects(createAndEnqueueFixPr('user-1', 'scan-1', 'finding-1'))

    assert.equal(mockFixPrUpdate.mock.calls.length, 1)
    const updateArgs = mockFixPrUpdate.mock.calls[0][0]
    assert.equal(updateArgs.data.status, 'FAILED')
  })
})
