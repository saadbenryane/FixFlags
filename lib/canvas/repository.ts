import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import type {
  CanvasDocument,
  CanvasRepository,
  CanvasSourceReference,
  CanvasVersionRecord,
  ReportCanvasRecord,
} from '@/lib/canvas/domain'

type CanvasPrismaClient = Pick<PrismaClient, 'reportCanvas' | 'canvasVersion' | '$transaction'>
const MAX_APPEND_ATTEMPTS = 5

function toCanvas(row: {
  id: string; projectId: string; sourceAuditId: string; title: string; status: string
  currentVersion: number; createdById: string; createdAt: Date; updatedAt: Date
}): ReportCanvasRecord {
  return { ...row, status: row.status as ReportCanvasRecord['status'] }
}

function toVersion(row: {
  canvasId: string; version: number; instruction: string; document: unknown
  sourceRefs: unknown; model: string | null; inputTokens: number; outputTokens: number
  cacheReadTokens: number; cacheWriteTokens: number; createdById: string; createdAt: Date
}): CanvasVersionRecord {
  return {
    ...row,
    document: row.document as CanvasDocument,
    sourceRefs: row.sourceRefs as CanvasSourceReference[],
  }
}

export class PrismaCanvasRepository implements CanvasRepository {
  constructor(private readonly client: CanvasPrismaClient = prisma) {}

  async createCanvas(input: {
    projectId: string; sourceAuditId: string; title: string; createdById: string
  }): Promise<ReportCanvasRecord> {
    return toCanvas(await this.client.reportCanvas.create({ data: input }))
  }

  async getCanvas(id: string): Promise<ReportCanvasRecord | null> {
    const row = await this.client.reportCanvas.findUnique({ where: { id } })
    return row ? toCanvas(row) : null
  }

  async listCanvases(input: { projectId: string; sourceAuditId?: string }): Promise<ReportCanvasRecord[]> {
    const rows = await this.client.reportCanvas.findMany({
      where: { projectId: input.projectId, sourceAuditId: input.sourceAuditId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toCanvas)
  }

  async listVersions(canvasId: string): Promise<CanvasVersionRecord[]> {
    const rows = await this.client.canvasVersion.findMany({
      where: { canvasId },
      orderBy: { version: 'desc' },
    })
    return rows.map(toVersion)
  }

  async getVersion(canvasId: string, version: number): Promise<CanvasVersionRecord | null> {
    const row = await this.client.canvasVersion.findUnique({
      where: { canvasId_version: { canvasId, version } },
    })
    return row ? toVersion(row) : null
  }

  async appendVersion(
    input: Omit<CanvasVersionRecord, 'version' | 'createdAt'>
  ): Promise<CanvasVersionRecord> {
    for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
      const result = await this.client.$transaction(async (tx) => {
        const canvas = await tx.reportCanvas.findUnique({
          where: { id: input.canvasId },
          select: { currentVersion: true },
        })
        if (!canvas) return { kind: 'missing' as const }
        const nextVersion = canvas.currentVersion + 1
        const claimed = await tx.reportCanvas.updateMany({
          where: { id: input.canvasId, currentVersion: canvas.currentVersion },
          data: { currentVersion: nextVersion, status: 'READY' },
        })
        if (claimed.count !== 1) return { kind: 'retry' as const }
        const version = await tx.canvasVersion.create({
          data: {
            canvasId: input.canvasId,
            version: nextVersion,
            instruction: input.instruction,
            document: input.document as unknown as Prisma.InputJsonObject,
            sourceRefs: input.sourceRefs as unknown as Prisma.InputJsonArray,
            model: input.model,
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            cacheReadTokens: input.cacheReadTokens,
            cacheWriteTokens: input.cacheWriteTokens,
            createdById: input.createdById,
          },
        })
        return { kind: 'created' as const, version }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      if (result.kind === 'missing') throw new Error('Canvas not found')
      if (result.kind === 'created') return toVersion(result.version)
    }
    throw new Error('Canvas changed concurrently; retry the update')
  }

  async markFailed(canvasId: string): Promise<ReportCanvasRecord> {
    return toCanvas(await this.client.reportCanvas.update({
      where: { id: canvasId },
      data: { status: 'FAILED' },
    }))
  }
}

export const canvasRepository = new PrismaCanvasRepository()
