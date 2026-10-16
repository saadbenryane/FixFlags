import { createServer, type ServerResponse, type RequestListener } from 'node:http'
import type { Socket } from 'node:net'
import { setTimeout as pause } from 'node:timers/promises'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkR2Connection, deleteAuditScreenshots, getScreenshotBytes, uploadScreenshot } from '../r2'
import { uploadScreenshot as uploadStoredScreenshot, readScreenshot } from '../screenshots'
import { uploadIntegrityArtifact, readIntegrityArtifact, deleteIntegrityPathArtifacts } from '@/lib/integrity/storage'

afterEach(() => vi.unstubAllEnvs())

async function storageFixture(handler: RequestListener) {
  const sockets = new Set<Socket>(), requests: string[] = []
  const server = createServer((request, response) => { requests.push(request.method + ' ' + request.url); handler(request, response) })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  for (const [key, value] of Object.entries({ R2_ACCOUNT_ID: 'fixture', R2_ACCESS_KEY_ID: 'fixture-key', R2_SECRET_ACCESS_KEY: 'fixture-secret',
    R2_BUCKET_NAME: 'fixture-bucket', R2_PUBLIC_URL: origin, R2_S3_ENDPOINT: origin, R2_FORCE_PATH_STYLE: 'true' })) vi.stubEnv(key, value)
  return { origin, sockets, requests, close: async () => {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  } }
}

describe('private screenshot transport with the installed S3 SDK', () => {
  it('aborts an unfinished object body and closes its socket at the caller deadline', async () => {
    let response: ServerResponse | undefined, disconnected = false
    const fixture = await storageFixture((_request, outgoing) => {
      response = outgoing
      outgoing.on('close', () => { disconnected = true })
      outgoing.writeHead(200, { 'content-type': 'image/png', 'content-length': '2' })
      outgoing.write('a')
    })
    let settled = false
    const reading = getScreenshotBytes('screenshots/fixture/desktop.png', { deadline: Date.now() + 1_000 })
      .then(value => { settled = true; return value }, error => { settled = true; throw error })
    void reading.catch(() => undefined)
    try {
      await vi.waitFor(() => expect(response).toBeDefined(), { timeout: 2_000, interval: 10 })
      await pause(1_100)
      expect(settled).toBe(true)
      await expect(reading).rejects.toMatchObject({ code: 'ETIMEDOUT' })
      await vi.waitFor(() => expect(disconnected).toBe(true), { timeout: 1_000, interval: 10 })
    } finally {
      response?.end('b')
      await reading.catch(() => undefined)
      await fixture.close()
    }
  })
  it.each(['read', 'write', 'integrity-write', 'integrity-read', 'integrity-delete', 'health', 'list', 'delete'] as const)('bounds a stalled %s response and destroys the physical connection', async kind => {
    vi.stubEnv('NODE_ENV', 'production')
    const fixture = await storageFixture((request, response) => {
      request.resume()
      if ((kind === 'delete' || kind === 'integrity-delete') && request.method === 'GET') {
        response.setHeader('content-type', 'application/xml')
        const key = kind === 'delete' ? 'screenshots/fixture/desktop.png' : 'integrity/path-fixture-123/frame.png'
        response.end('<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>' + key + '</Key></Contents></ListBucketResult>')
      }
    })
    try {
      const options = { deadline: Date.now() + 1_000 }
      const operation = kind === 'read' ? getScreenshotBytes('screenshots/fixture/desktop.png', options)
        : kind === 'write' ? uploadScreenshot('fixture', 'desktop', Buffer.from('image'), null, options)
          : kind === 'integrity-write' ? uploadIntegrityArtifact('fixture', 'frame.png', Buffer.from('image'), 'image/png', options)
            : kind === 'integrity-read' ? readIntegrityArtifact('fixture', 'frame.png', options)
              : kind === 'integrity-delete' ? deleteIntegrityPathArtifacts(['fixture'], options)
                : kind === 'health' ? checkR2Connection(options) : deleteAuditScreenshots(['fixture'], options)
      await expect(operation).rejects.toMatchObject({ code: 'ETIMEDOUT' })
      expect(fixture.requests).toHaveLength(kind === 'delete' || kind === 'integrity-delete' ? 2 : 1)
      await vi.waitFor(() => expect(fixture.sockets.size).toBe(0), { timeout: 1_000, interval: 10 })
    } finally { await fixture.close() }
  })
  it('preserves production wrapper deadlines and upload failure causes', async () => {
    const fixture = await storageFixture(request => { request.resume() })
    vi.stubEnv('NODE_ENV', 'production')
    try {
      await expect(uploadStoredScreenshot('fixture', 'desktop', Buffer.from('image'), 'page', { deadline: Date.now() + 100 }))
        .rejects.toMatchObject({ name: 'StorageUploadError', cause: { code: 'ETIMEDOUT' } })
      await expect(readScreenshot('fixture', 'desktop', 'page', { deadline: Date.now() + 100 }))
        .rejects.toMatchObject({ code: 'ETIMEDOUT' })
      await vi.waitFor(() => expect(fixture.sockets.size).toBe(0))
    } finally { await fixture.close() }
  })
  it('retains binary reads, confirmed writes and explicit missing objects, closing successful connections too', async () => {
    const fixture = await storageFixture((request, response) => {
      request.resume()
      if (request.url?.includes('missing')) { response.writeHead(404, { 'content-type': 'application/xml' }); response.end('<Error><Code>NoSuchKey</Code></Error>') }
      else if (request.method === 'GET') response.end(Buffer.from([0, 255, 128, 1]))
      else response.end()
    })
    try {
      expect(await uploadScreenshot('fixture', 'desktop', Buffer.from('image'))).toBe(fixture.origin + '/screenshots/fixture/desktop.png')
      expect(await getScreenshotBytes('screenshots/fixture/desktop.png')).toEqual(Buffer.from([0, 255, 128, 1]))
      expect(await getScreenshotBytes('screenshots/missing/desktop.png')).toBeNull()
      await checkR2Connection()
      await vi.waitFor(() => expect(fixture.sockets.size).toBe(0))
    } finally { await fixture.close() }
  })
  it('keeps partial object deletion errors visible for reconciliation', async () => {
    const fixture = await storageFixture((request, response) => {
      request.resume(); response.setHeader('content-type', 'application/xml')
      response.end(request.method === 'GET'
        ? '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>screenshots/fixture/desktop.png</Key></Contents></ListBucketResult>'
        : '<DeleteResult><Error><Key>screenshots/fixture/desktop.png</Key><Code>AccessDenied</Code></Error></DeleteResult>')
    })
    try { await expect(deleteAuditScreenshots(['fixture'])).rejects.toThrow('Customer data is retained for reconciliation') }
    finally { await fixture.close() }
  })
  it('shares private object transport for integrity upload, retrieval and exact-prefix deletion', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.fixture.test')
    let deleteBody = ''
    const fixture = await storageFixture((request, response) => {
      response.setHeader('content-type', 'application/xml')
      if (request.method === 'PUT') {
        expect(request.headers['cache-control']).toBe('private, no-store')
        expect(request.headers['content-type']).toBe('video/webm')
        request.resume(); response.end()
      } else if (request.url?.includes('list-type=2')) {
        expect(new URL(request.url, 'http://fixture').searchParams.get('prefix')).toBe('integrity/path-fixture-')
        response.end('<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>integrity/path-fixture-123/walk.webm</Key></Contents></ListBucketResult>')
      } else if (request.method === 'POST') {
        request.on('data', chunk => { deleteBody += chunk.toString() })
        request.on('end', () => response.end('<DeleteResult/>'))
      } else response.end(Buffer.from([0, 255, 128, 1]))
    })
    try {
      const stored = await uploadIntegrityArtifact('path-fixture-123', 'walk.webm', Buffer.from('video'), 'video/webm')
      expect(stored.key).toBe('integrity/path-fixture-123/walk.webm')
      expect(stored.localPath).toBeNull()
      expect(stored.url).toContain('/api/integrity-assets/path-fixture-123/walk.webm')
      expect(await readIntegrityArtifact('path-fixture-123', 'walk.webm')).toEqual(Buffer.from([0, 255, 128, 1]))
      await deleteIntegrityPathArtifacts(['fixture'])
      expect(deleteBody).toContain('<Key>integrity/path-fixture-123/walk.webm</Key>')
      expect(fixture.requests.slice(0, 2)).toEqual(['PUT /fixture-bucket/integrity/path-fixture-123/walk.webm?x-id=PutObject',
        'GET /fixture-bucket/integrity/path-fixture-123/walk.webm?x-id=GetObject'])
      await vi.waitFor(() => expect(fixture.sockets.size).toBe(0))
    } finally { await fixture.close() }
  })
  it('refuses missing production storage rather than emitting an inaccessible local artifact', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('R2_ACCESS_KEY_ID', '')
    await expect(uploadIntegrityArtifact('fixture', 'frame.png', Buffer.from('frame'), 'image/png')).rejects.toThrow('R2 storage is not configured')
    await expect(readIntegrityArtifact('fixture', 'frame.png')).rejects.toThrow('R2 storage is not configured')
    await expect(deleteIntegrityPathArtifacts(['fixture'])).rejects.toThrow('R2 storage is not configured')
  })
  it('removes unreceipted local path artifacts while retaining a neighboring path', async () => {
    const id = randomUUID().replaceAll('-', ''), neighbor = id + 'x'
    const ownRun = 'path-' + id + '-123', otherRun = 'path-' + neighbor + '-123'
    try {
      await uploadIntegrityArtifact(ownRun, 'frame.png', Buffer.from('orphaned frame'), 'image/png')
      await uploadIntegrityArtifact(otherRun, 'frame.png', Buffer.from('retained frame'), 'image/png')
      await deleteIntegrityPathArtifacts([id])
      expect(await readIntegrityArtifact(ownRun, 'frame.png')).toBeNull()
      expect(await readIntegrityArtifact(otherRun, 'frame.png')).toEqual(Buffer.from('retained frame'))
      await expect(deleteIntegrityPathArtifacts(['../other'])).rejects.toThrow('canonical integrity path ID')
    } finally {
      for (const run of [ownRun, otherRun]) await fs.rm(path.join(process.cwd(), '.data', 'integrity', run), { recursive: true, force: true })
    }
  })
  it('does not start a request after cancellation or expiry', async () => {
    const fixture = await storageFixture((_request, response) => { response.end() })
    try {
      await expect(getScreenshotBytes('screenshots/fixture/desktop.png', { deadline: Date.now() - 1 })).rejects.toMatchObject({ code: 'ETIMEDOUT' })
      const controller = new AbortController(); controller.abort(new Error('Caller cancelled storage'))
      await expect(uploadScreenshot('fixture', 'desktop', Buffer.from('image'), null, { signal: controller.signal })).rejects.toThrow('Caller cancelled storage')
      expect(fixture.requests).toEqual([])
    } finally { await fixture.close() }
  })
})
