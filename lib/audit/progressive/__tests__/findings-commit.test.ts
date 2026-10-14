import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { commitFindings } from '../results'
import { serializeArtifact } from '../contracts'
import type { TaskContext } from '../registry'

describe('finding publication cost', () => {
  it('does not read the finding ledger or rewrite report rows for a task with no new findings', async () => {
    const read = vi.fn().mockRejectedValue(new Error('An empty result must not rebuild the report'))
    const tx = { $queryRaw: read } as unknown as Prisma.TransactionClient
    await commitFindings({ audit: { id: 'running-analysis' } } as TaskContext,
      serializeArtifact('check', { flags: [] }), tx)
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects malformed incoming findings before reading the ledger', async () => {
    const read = vi.fn()
    await expect(commitFindings({ audit: { id: 'running-analysis' } } as TaskContext,
      serializeArtifact('check', { flags: [{ checkId: 'title-missing' }] }), { $queryRaw: read } as unknown as Prisma.TransactionClient))
      .rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })
})
