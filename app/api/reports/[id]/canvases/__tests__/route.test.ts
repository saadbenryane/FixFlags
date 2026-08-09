import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
const resolveCanvasReportAccess = vi.hoisted(() => vi.fn())
const listCanvases = vi.hoisted(() => vi.fn())
const createCanvas = vi.hoisted(() => vi.fn())
const appendVersion = vi.hoisted(() => vi.fn())
const getCanvas = vi.hoisted(() => vi.fn())
const markFailed = vi.hoisted(() => vi.fn())
const buildCanvasEvidenceBundle = vi.hoisted(() => vi.fn())
const generateGroundedCanvas = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/canvas/access', () => ({ resolveCanvasReportAccess }))
vi.mock('@/lib/canvas/repository', () => ({
  canvasRepository: { listCanvases, createCanvas, appendVersion, getCanvas, markFailed },
}))
vi.mock('@/lib/canvas/evidence', () => ({ buildCanvasEvidenceBundle }))
vi.mock('@/lib/canvas/generation', () => ({ generateGroundedCanvas }))
vi.mock('@/lib/canvas/provider', () => ({
  configuredCanvasGenerator: {},
  CanvasProviderUnavailableError: class CanvasProviderUnavailableError extends Error {},
}))

import { GET, POST } from '@/app/api/reports/[id]/canvases/route'

const params = { params: Promise.resolve({ id: 'audit-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('Canvas collection route', () => {
  it('does not leak Canvas data without paid owner access', async () => {
    resolveCanvasReportAccess.mockResolvedValue({ allowed: false, reason: 'PAID_PLAN_REQUIRED' })
    const response = await GET(new Request('http://localhost') as never, params)
    expect(response.status).toBe(402)
    expect(listCanvases).not.toHaveBeenCalled()
  })

  it('lists only Canvases belonging to the selected report and Product', async () => {
    resolveCanvasReportAccess.mockResolvedValue({
      allowed: true,
      audit: { id: 'audit-1', projectId: 'project-1', userId: 'user-1' },
      user: { id: 'user-1' },
    })
    listCanvases.mockResolvedValue([{ id: 'canvas-1' }])
    const response = await GET(new Request('http://localhost') as never, params)
    expect(response.status).toBe(200)
    expect(listCanvases).toHaveBeenCalledWith({ projectId: 'project-1', sourceAuditId: 'audit-1' })
  })

  it('returns a truthful unavailable response without creating placeholder data', async () => {
    resolveCanvasReportAccess.mockResolvedValue({
      allowed: true,
      audit: { id: 'audit-1', projectId: 'project-1', userId: 'user-1' },
      user: { id: 'user-1' },
    })
    const { CanvasProviderUnavailableError } = await import('@/lib/canvas/provider')
    buildCanvasEvidenceBundle.mockResolvedValue({ auditId: 'audit-1', projectId: 'project-1' })
    generateGroundedCanvas.mockRejectedValue(new CanvasProviderUnavailableError())
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Release plan', instruction: 'Create a Canvas' }),
    }) as never, params)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'CANVAS_GENERATION_UNAVAILABLE' })
    expect(createCanvas).not.toHaveBeenCalled()
  })

  it('persists a grounded generated document as version one', async () => {
    resolveCanvasReportAccess.mockResolvedValue({
      allowed: true,
      audit: { id: 'audit-1', projectId: 'project-1', userId: 'user-1' },
      user: { id: 'user-1' },
    })
    buildCanvasEvidenceBundle.mockResolvedValue({ auditId: 'audit-1', projectId: 'project-1' })
    generateGroundedCanvas.mockResolvedValue({
      document: { schemaVersion: 1, title: 'Release plan', blocks: [] },
      sourceRefs: [],
      usage: { model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5 },
    })
    createCanvas.mockResolvedValue({ id: 'canvas-1' })
    appendVersion.mockResolvedValue({ canvasId: 'canvas-1', version: 1 })
    getCanvas.mockResolvedValue({ id: 'canvas-1', currentVersion: 1, status: 'READY' })
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Release plan', instruction: 'Create a Canvas' }),
    }) as never, params)
    expect(response.status).toBe(201)
    expect(appendVersion).toHaveBeenCalledWith(expect.objectContaining({
      canvasId: 'canvas-1', createdById: 'user-1', instruction: 'Create a Canvas',
      model: 'canvas-model', inputTokens: 100, outputTokens: 40,
      cacheReadTokens: 20, cacheWriteTokens: 5,
    }))
  })

  it('persists neither a version nor usage for invalid generated output', async () => {
    const { CanvasValidationError } = await import('@/lib/canvas/validation')
    resolveCanvasReportAccess.mockResolvedValue({
      allowed: true,
      audit: { id: 'audit-1', projectId: 'project-1', userId: 'user-1' },
      user: { id: 'user-1' },
    })
    buildCanvasEvidenceBundle.mockResolvedValue({ auditId: 'audit-1', projectId: 'project-1' })
    generateGroundedCanvas.mockRejectedValue(new CanvasValidationError('Invalid', ['ungrounded']))
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Release plan', instruction: 'Create a Canvas' }),
    }) as never, params)
    expect(response.status).toBe(422)
    expect(createCanvas).not.toHaveBeenCalled()
    expect(appendVersion).not.toHaveBeenCalled()
  })
})
