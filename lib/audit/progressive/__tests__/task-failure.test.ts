import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { PageCaptureError } from '@/lib/audit/browser/page-capture'
import { StorageNotConfiguredError, StorageUploadError } from '@/lib/audit/pipeline-errors'
import { TaskFailure, retryDecision } from '../contracts'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/queue/client', () => ({ getAuditTaskQueue: vi.fn() }))
vi.mock('@/lib/audit/screenshot', () => ({ getBrowserDiagnostics: vi.fn() }))
vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: vi.fn() }))
import { classifyTaskFailure } from '../engine'

describe('observed scope and operational interruption policy', () => {
  it.each([
    ['HTTP_ERROR', 404], ['HTTP_ERROR', 503], ['HTTP_FORBIDDEN', 403], ['HTTP_FORBIDDEN', 200],
    ['HTTP_RATE_LIMIT', 429], ['NON_HTML_RESPONSE', 200],
  ] as const)('settles an observed %s response (%i) without treating it as a worker crash', (code, status) => {
    const failure = classifyTaskFailure(new PageCaptureError('Unavailable page response', { code, httpStatus: status,
      contentType: 'text/html', finalUrl: 'https://example.com/' }))
    expect(failure).toMatchObject({ code: 'PAGE_' + code, retryable: false, crash: false })
    expect(retryDecision({ now: 0, admittedAt: 0, attempts: 1, crash: failure.crash, retryable: failure.retryable }).retry).toBe(false)
  })
  it.each(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'])('retains recovery for an interrupted transport: %s', code => {
    expect(classifyTaskFailure(Object.assign(new Error('Interrupted'), { code }))).toMatchObject({ code: 'DEPENDENCY_INTERRUPTED', retryable: true, crash: false })
  })
  it('retains bounded crash recovery for an unclassified browser or parser failure', () => {
    expect(classifyTaskFailure(new PageCaptureError('Unknown capture interruption', { code: 'CAPTURE_FAILED' })))
      .toMatchObject({ code: 'TASK_INTERRUPTED', retryable: true, crash: true })
    expect(classifyTaskFailure(new Error('Unexpected parser failure'))).toMatchObject({ code: 'TASK_INTERRUPTED', retryable: true, crash: true })
  })
  it('retains declared provider backoff, database recovery and storage policy', () => {
    const quota = new TaskFailure('PROVIDER_QUOTA', true, 120_000)
    expect(classifyTaskFailure(quota)).toBe(quota)
    expect(classifyTaskFailure(new Prisma.PrismaClientKnownRequestError('Database interrupted', { code: 'P1001', clientVersion: 'test' })))
      .toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', retryable: true, crash: false })
    expect(classifyTaskFailure(new Prisma.PrismaClientKnownRequestError('Transaction already closed', { code: 'P2028', clientVersion: 'test' })))
      .toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', retryable: true, crash: false })
    expect(classifyTaskFailure(new Error('Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected`')))
      .toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', retryable: true, crash: false })
    expect(classifyTaskFailure(new StorageNotConfiguredError('Storage unavailable'))).toMatchObject({ code: 'STORAGE_NOT_CONFIGURED', retryable: false })
    expect(classifyTaskFailure(new StorageUploadError('Upload interrupted'))).toMatchObject({ code: 'STORAGE_UPLOAD_INTERRUPTED', retryable: true })
  })
})
