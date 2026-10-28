import { createServer, type ServerResponse } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeFetchDocument, safeFetchHtml, safeFetchResource, PublicRequestError } from '../url'
import { withExecutionOwnership } from '../execution-ownership'
import { publicHttpCapacity } from '../progressive/capacity'

vi.mock('@/lib/db', () => ({ prisma: { audit: {
  updateMany: vi.fn(async () => ({ count: 1 })), findFirst: vi.fn(async () => ({ id: 'http-owner' })),
} } }))

const pending = new Set<ServerResponse>()
const requests: string[] = []
const server = createServer((request, response) => {
  requests.push(request.url!)
  response.setHeader('content-type', 'text/html')
  if (request.url === '/ready') { response.end('<html>Current observation</html>'); return }
  pending.add(response)
  response.on('close', () => pending.delete(response))
  if (request.url === '/body') response.write('<html>Partial observation')
})
let origin = ''
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
})
afterEach(async () => {
  for (const response of pending) response.destroy()
  await vi.waitFor(() => expect(publicHttpCapacity.running).toBe(0))
  expect(publicHttpCapacity.queued).toBe(0)
  requests.length = 0
})
afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  vi.unstubAllEnvs()
})

function owned<T>(signal: AbortSignal, work: () => Promise<T>) {
  return withExecutionOwnership({ auditId: 'http-owner', token: 'http-attempt', generation: 1, signal }, work)
}

describe('execution-owned public HTTP lifetime', () => {
  it('removes canceled capacity waiters without starting a request', async () => {
    const releases = await Promise.all(Array.from({ length: publicHttpCapacity.capacity }, () => publicHttpCapacity.acquire()))
    const controller = new AbortController()
    const request = owned(controller.signal, () => safeFetchDocument(origin + '/headers', { timeoutMs: 3000 }))
    const settled = request.then(() => 'completed', () => 'cancelled')
    try {
      await vi.waitFor(() => expect(publicHttpCapacity.queued).toBe(1))
      controller.abort()
      await vi.waitFor(() => expect(publicHttpCapacity.queued).toBe(0), { timeout: 500 })
      expect(await settled).toBe('cancelled')
      expect(requests).toEqual([])
    } finally {
      releases.forEach(release => release())
      server.closeAllConnections()
      await settled
    }
  })

  it.each([
    { kind: 'document headers', fetch: safeFetchDocument, path: '/headers' },
    { kind: 'document body', fetch: safeFetchDocument, path: '/body' },
    { kind: 'HTML body', fetch: safeFetchHtml, path: '/body' },
    { kind: 'binary body', fetch: safeFetchResource, path: '/body' },
  ])('stops native $kind collection and frees capacity for an independent observation', async ({ fetch, path }) => {
    const controller = new AbortController()
    const request = owned(controller.signal, () => fetch(origin + path, { timeoutMs: 3000 }))
    const settled = request.then(value => ({ value, error: null }), error => ({ value: null, error }))
    try {
      await vi.waitFor(() => expect(requests).toEqual([path]))
      expect(publicHttpCapacity.running).toBe(1)
      controller.abort()
      await vi.waitFor(() => expect(publicHttpCapacity.running).toBe(0), { timeout: 500 })
      const result = await settled
      expect(result.value).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error).not.toBeInstanceOf(PublicRequestError)
      await vi.waitFor(() => expect(pending.size).toBe(0), { timeout: 500 })
      expect(await safeFetchDocument(origin + '/ready')).toMatchObject({ statusCode: 200, complete: true })
    } finally { server.closeAllConnections(); await settled }
  })

  it('refuses a new request in an already canceled continuation', async () => {
    const controller = new AbortController()
    await owned(controller.signal, async () => {
      controller.abort()
      await expect(safeFetchDocument(origin + '/ready')).rejects.toBeDefined()
    })
    expect(requests).toEqual([])
  })
})
