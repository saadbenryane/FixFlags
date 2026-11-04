import { createSocket } from 'node:dgram'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ server: '' }))
vi.mock('node:dns/promises', async original => {
  const native = await original<typeof import('node:dns/promises')>()
  return { ...native, Resolver: class extends native.Resolver {
    constructor(options?: import('node:dns').ResolverOptions) {
      super(options)
      this.setServers([fixture.server])
    }
  } }
})
import { assertPublicNavigationUrl, resolvePublicAddresses, safeFetchDocument } from '../url'
import { classifyPublicRequestFailure } from '../http-failure'
import { publicHttpCapacity } from '../progressive/capacity'

describe('native public DNS cancellation', () => {
  const server = createSocket('udp4')
  let queries = 0, answerThrough = 0
  beforeAll(async () => {
    // Receive real A and AAAA queries without answering. No external resolver
    // or website participates in this controlled timeout proof.
    server.on('message', (query, sender) => {
      queries++
      if (queries > answerThrough) return
      let end = 12
      while (query[end]) end += query[end] + 1
      const type = query.readUInt16BE(end + 1), questionEnd = end + 5
      const answer = type === 1 ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 93, 184, 216, 34]) : Buffer.alloc(0)
      const response = Buffer.concat([query.subarray(0, questionEnd), answer])
      response.writeUInt16BE(0x8180, 2); response.writeUInt16BE(type === 1 ? 1 : 0, 6)
      response.writeUInt16BE(0, 8); response.writeUInt16BE(0, 10)
      server.send(response, sender.port, sender.address)
    })
    await new Promise<void>(resolve => server.bind(0, '127.0.0.1', resolve))
    fixture.server = '127.0.0.1:' + server.address().port
  })
  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))
  it('stops real pending queries within the admission budget without a caller signal', async () => {
    const startedAt = Date.now()
    await expect(assertPublicNavigationUrl('https://stalled.fixture.test/')).rejects.toMatchObject({ code: 'DNS_UNAVAILABLE' })
    expect(queries).toBeGreaterThanOrEqual(2)
    expect(Date.now() - startedAt).toBeLessThan(7000)
  }, 10_000)
  it('cancels only the owning resolver while another Site remains pending', async () => {
    const before = queries, first = new AbortController(), second = new AbortController()
    const reason = new Error('First owner stopped'), otherReason = new Error('Second owner stopped')
    let secondStopped = false
    const one = resolvePublicAddresses('first.fixture.test', first.signal).catch(error => error)
    const two = resolvePublicAddresses('second.fixture.test', second.signal).catch(error => { secondStopped = true; return error })
    try {
      await vi.waitFor(() => expect(queries - before).toBeGreaterThanOrEqual(4), { timeout: 1000, interval: 10 })
      first.abort(reason)
      expect(await one).toBe(reason)
      expect(secondStopped).toBe(false)
    } finally { first.abort(reason); second.abort(otherReason) }
    expect(await two).toBe(otherReason)
  })
  it('keeps expiry of the real connection-time lookup unknown after a public preflight', async () => {
    const before = queries
    // Answer preflight A and AAAA only. The connection must independently
    // validate its addresses, so no origin socket receives an address.
    answerThrough = before + 2
    try {
      const failure = await safeFetchDocument('http://connection.fixture.test/', { publicOnly: true, timeoutMs: 250 }).catch(error => error)
      expect(queries - before).toBe(4)
      expect(failure).toMatchObject({ code: 'DNS_UNAVAILABLE' })
      expect(classifyPublicRequestFailure(failure).result).toBe('UNKNOWN')
      expect(publicHttpCapacity.running).toBe(0)
      expect(publicHttpCapacity.queued).toBe(0)
    } finally { answerThrough = 0 }
  })
})
