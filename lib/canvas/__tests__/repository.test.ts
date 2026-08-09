import { describe, expect, it, vi } from 'vitest'
import { PrismaCanvasRepository } from '@/lib/canvas/repository'
import type { CanvasDocument } from '@/lib/canvas/domain'

const document: CanvasDocument = {
  schemaVersion: 1,
  title: 'Release plan',
  blocks: [{ id: 'heading', type: 'heading', level: 2, text: 'Priorities', sourceRefIds: [] }],
}

describe('PrismaCanvasRepository', () => {
  it('atomically appends an immutable next version', async () => {
    const versionCreate = vi.fn().mockResolvedValue({
      canvasId: 'canvas-1', version: 3, instruction: 'Revise', document, sourceRefs: [],
      model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5,
      createdById: 'user-1', createdAt: new Date('2026-08-09T00:00:00Z'),
    })
    const tx = {
      reportCanvas: {
        findUnique: vi.fn().mockResolvedValue({ currentVersion: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      canvasVersion: { create: versionCreate },
    }
    const client = {
      $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
    }
    const repository = new PrismaCanvasRepository(client as never)
    const result = await repository.appendVersion({
      canvasId: 'canvas-1', instruction: 'Revise', document, sourceRefs: [], createdById: 'user-1',
      model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5,
    })

    expect(result.version).toBe(3)
    expect(tx.reportCanvas.updateMany).toHaveBeenCalledWith({
      where: { id: 'canvas-1', currentVersion: 2 },
      data: { currentVersion: 3, status: 'READY' },
    })
    expect(versionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      version: 3, model: 'canvas-model', inputTokens: 100, outputTokens: 40,
      cacheReadTokens: 20, cacheWriteTokens: 5,
    }) })
    expect(versionCreate.mock.calls[0]?.[0].data).not.toHaveProperty('id')
  })

  it('retries a lost compare-and-swap without overwriting a version', async () => {
    const versions = [2, 3]
    const tx = {
      reportCanvas: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve({ currentVersion: versions.shift() })),
        updateMany: vi.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      canvasVersion: { create: vi.fn().mockResolvedValue({
        canvasId: 'canvas-1', version: 4, instruction: 'Revise', document, sourceRefs: [],
        model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5,
        createdById: 'user-1', createdAt: new Date(),
      }) },
    }
    const client = { $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)) }
    const repository = new PrismaCanvasRepository(client as never)
    const result = await repository.appendVersion({
      canvasId: 'canvas-1', instruction: 'Revise', document, sourceRefs: [], createdById: 'user-1',
      model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5,
    })
    expect(result.version).toBe(4)
    expect(client.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.canvasVersion.create).toHaveBeenCalledTimes(1)
  })
})
