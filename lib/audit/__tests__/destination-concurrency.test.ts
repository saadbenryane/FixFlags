import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { openCheckDestination, openCheckDestinations } from '../open-check'
import { publicLinkObservations } from '../checks/public-links'
import { destinationContext } from '../checks/destination-evidence'

let origin = '', active = 0, peak = 0
const requests: string[] = []
const server = createServer((request, response) => {
  const path = request.url ?? '/'
  requests.push(path); active++; peak = Math.max(peak, active)
  let released = false
  const release = () => { if (!released) { active--; released = true } }
  response.once('finish', release); response.once('close', release)
  if (path === '/slow') return
  response.setHeader('content-type', 'text/html')
  response.statusCode = path === '/missing' ? 404 : 200
  response.end('<!doctype html><html><head><title>Useful details</title></head><body><h1>Useful details</h1></body></html>')
})
beforeAll(async () => {
  vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
})
afterAll(async () => {
  vi.unstubAllEnvs(); server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe('independent public destination collection', () => {
  it('uses free capacity to observe later destinations while an earlier request is stalled', async () => {
    requests.length = 0; peak = active
    const urls = ['/slow', ...Array.from({ length: 10 }, (_, index) => '/healthy-' + index), '/missing'].map(path => origin + path)
    const opened = await openCheckDestinations(urls, { origin, concurrency: 2, deadline: Date.now() + 800 })
    expect(opened.results.map(result => result.url)).toEqual(urls)
    expect(opened.results[0]).toMatchObject({ status: null, shouldFlagDead: false })
    expect(opened.results.slice(1, -1).every(result => result.status === 200 && result.outcome === 'reachable')).toBe(true)
    expect(opened.results.at(-1)).toMatchObject({ status: 404, outcome: 'not_found', shouldFlagDead: true })
    expect(requests).toContain('/missing')
    expect(peak).toBeLessThanOrEqual(2)
    const observed = publicLinkObservations(origin, urls, opened.results)
    expect(observed.complete).toBe(false)
    expect(observed.assertions[0]).toMatchObject({ complete: false, passed: false })
    expect(observed.assertions.at(-1)).toMatchObject({ complete: true, passed: false })
    expect(observed.flags).toHaveLength(1)
    expect(observed.flags[0]).toMatchObject({ checkId: 'broken-internal-links',
      evidenceTargets: [{ context: destinationContext(origin, urls.at(-1)!) }] })
    await vi.waitFor(() => expect(active).toBe(0), { timeout: 1000, interval: 10 })
  })

  it('retains independent native observations when one destination adapter rejects', async () => {
    const urls = ['/adapter-error', '/healthy-independent', '/missing'].map(path => origin + path)
    const opened = await openCheckDestinations(urls, { origin, concurrency: 2,
      openDestination: async (url, options) => {
        if (url.endsWith('/adapter-error')) throw new Error('Controlled destination observation interruption')
        return openCheckDestination(url, options)
      } })
    expect(opened.results.map(result => result.url)).toEqual(urls)
    expect(opened.results[0]).toMatchObject({ status: null, outcome: 'unknown', shouldFlagDead: false })
    expect(opened.results[1]).toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
    expect(opened.results[2]).toMatchObject({ status: 404, outcome: 'not_found', shouldFlagDead: true })
    expect(JSON.stringify(opened)).not.toContain('Controlled destination observation interruption')
  })
})
