import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
const resolveCanvasReportAccess = vi.hoisted(() => vi.fn())
const getCanvas = vi.hoisted(() => vi.fn())
const getVersion = vi.hoisted(() => vi.fn())
const appendVersion = vi.hoisted(() => vi.fn())
const listVersions = vi.hoisted(() => vi.fn())
const buildCanvasEvidenceBundle = vi.hoisted(() => vi.fn())
const validateCanvasDocument = vi.hoisted(() => vi.fn())
const generateGroundedCanvas = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/canvas/access', () => ({ resolveCanvasReportAccess }))
vi.mock('@/lib/canvas/repository', () => ({
  canvasRepository: { getCanvas, getVersion, appendVersion, listVersions },
}))
vi.mock('@/lib/canvas/evidence', () => ({ buildCanvasEvidenceBundle }))
vi.mock('@/lib/canvas/validation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/canvas/validation')>()
  return { ...original, validateCanvasDocument }
})
vi.mock('@/lib/canvas/generation', () => ({ generateGroundedCanvas }))
vi.mock('@/lib/canvas/provider', () => ({
  configuredCanvasGenerator: {},
  CanvasProviderUnavailableError: class CanvasProviderUnavailableError extends Error {},
}))

import { POST } from '@/app/api/reports/[id]/canvases/[canvasId]/versions/route'

const context = { params: Promise.resolve({ id: 'audit-1', canvasId: 'canvas-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  resolveCanvasReportAccess.mockResolvedValue({
    allowed: true,
    audit: { id: 'audit-1', projectId: 'project-1', userId: 'user-1' },
    user: { id: 'user-1' },
  })
  buildCanvasEvidenceBundle.mockResolvedValue({ references: [] })
  validateCanvasDocument.mockImplementation((document) => document)
})

describe('Canvas version actions', () => {
  it('does not reveal a Canvas from another report', async () => {
    getCanvas.mockResolvedValue({ id: 'canvas-1', sourceAuditId: 'audit-2', projectId: 'project-1' })
    const response = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ action: 'restore', version: 1 }),
    }) as never, context)
    expect(response.status).toBe(404)
    expect(getVersion).not.toHaveBeenCalled()
  })

  it('restores by appending a new immutable version', async () => {
    getCanvas.mockResolvedValue({ id: 'canvas-1', sourceAuditId: 'audit-1', projectId: 'project-1' })
    const source = {
      canvasId: 'canvas-1', version: 1, instruction: 'Initial',
      document: { schemaVersion: 1, title: 'Plan', blocks: [] }, sourceRefs: [],
      createdById: 'user-1', createdAt: new Date(),
    }
    getVersion.mockResolvedValue(source)
    appendVersion.mockResolvedValue({ ...source, version: 3, instruction: 'Restore version 1' })
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'restore', version: 1 }),
    }) as never, context)
    expect(response.status).toBe(201)
    expect(appendVersion).toHaveBeenCalledWith(expect.objectContaining({
      canvasId: 'canvas-1', instruction: 'Restore version 1', createdById: 'user-1',
    }))
  })

  it('returns unavailable for revisions until a grounded generator is configured', async () => {
    getCanvas.mockResolvedValue({ id: 'canvas-1', sourceAuditId: 'audit-1', projectId: 'project-1' })
    const { CanvasProviderUnavailableError } = await import('@/lib/canvas/provider')
    buildCanvasEvidenceBundle.mockResolvedValue({ references: [] })
    generateGroundedCanvas.mockRejectedValue(new CanvasProviderUnavailableError())
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revise', instruction: 'Make it concise' }),
    }) as never, context)
    expect(response.status).toBe(503)
    expect(appendVersion).not.toHaveBeenCalled()
  })
})
