import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native auxiliary-page request authority', () => {
  afterAll(closeBrowser)
  it.each([false, true])('keeps initial popup POSTs outside owner-document authority when its policy allows %s', async allowed => {
    const reached: string[] = [], decisions: Array<{ method: string; body: string | null }> = []
    const server = createServer((request, response) => {
      reached.push(request.url!)
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/' ? '<!doctype html><title>Controlled form</title><main><h1>Controlled form</h1><form action="/initial-mutation" method="post" target="_blank"><input name="value" value="CONTROLLED"><button>Send fixture</button></form></main>'
        : '<!doctype html><title>Received</title><main><h1>Controlled request accepted</h1></main>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        deadline: Date.now() + 10_000, requestPolicy: async request => {
          if (!request.url.endsWith('/initial-mutation')) return true
          decisions.push({ method: request.method, body: request.postData })
          return allowed && request.postData === 'value=CONTROLLED'
        } })
      const result = session.page.context().waitForEvent('requestfailed', request => request.url().endsWith('/initial-mutation'))
      await session.page.getByRole('button', { name: 'Send fixture' }).click({ noWaitAfter: true })
      await result
      expect(decisions).toEqual([{ method: 'POST', body: 'value=CONTROLLED' }])
      expect(reached.filter(path => path === '/initial-mutation')).toHaveLength(0)
      if (allowed) expect(session.safetyRestrictions).toContain('auxiliary_document_unavailable')
    } catch (error) {
      throw new Error(JSON.stringify({ allowed, reached, decisions }), { cause: error })
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 15_000)
  it('keeps popup documents and requests inside the originating action policy', async () => {
    const reached: string[] = [], admitted: string[] = []
    const server = createServer((request, response) => {
      reached.push(request.url!)
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/' ? '<!doctype html><title>Useful service</title><main><h1>Useful service for your team</h1><button onclick="window.open(\'/popup\',\'pricing\')">Open pricing</button></main>'
        : request.url === '/popup' ? '<!doctype html><title>Pricing</title><main><h1>Plans for your team</h1></main><script>window.finished=0;for(const [url,method] of [["/mutation","POST"],["/denied","GET"]])fetch(url,{method}).catch(()=>{}).finally(()=>window.finished++)</script>'
          : '<!doctype html><title>Request received</title><p>Controlled fixture response</p>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        journeySafe: true, deadline: Date.now() + 12_000, requestPolicy: async request => {
          admitted.push(new URL(request.url).pathname)
          return !request.url.endsWith('/denied')
        } })
      const opened = session.page.context().waitForEvent('page')
      await session.page.getByRole('button', { name: 'Open pricing' }).click()
      const popup = await opened
      await popup.waitForLoadState('domcontentloaded')
      await popup.waitForFunction(() => (globalThis as unknown as { finished?: number }).finished === 2)
      expect(reached).not.toContain('/mutation')
      expect(reached).not.toContain('/denied')
      expect(admitted.filter(path => path === '/popup')).toHaveLength(1)
      expect(admitted.filter(path => path === '/mutation')).toHaveLength(1)
      expect(admitted.filter(path => path === '/denied')).toHaveLength(1)
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 20_000)
  it('refuses a redirected replay of an already authorized owner-document POST', async () => {
    const reached: string[] = [], decisions: string[] = []
    const server = createServer((request, response) => {
      reached.push(request.url!)
      if (request.url === '/first-write') { response.writeHead(307, { location: '/second-write' }); response.end(); return }
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/' ? '<!doctype html><title>Controlled form</title><form action="/first-write" method="post"><input name="value" value="CONTROLLED"><button>Send fixture</button></form>'
        : '<!doctype html><title>Unexpected replay</title><h1>Unexpected replay</h1>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        deadline: Date.now() + 10_000, requestPolicy: async request => {
          if (request.method !== 'POST') return true
          decisions.push(new URL(request.url).pathname)
          return decisions.length === 1 && request.postData === 'value=CONTROLLED'
        } })
      const rejected = session.page.context().waitForEvent('requestfailed', request => request.method() === 'POST')
      await session.page.getByRole('button', { name: 'Send fixture' }).click({ noWaitAfter: true })
      await rejected
      expect(decisions).toEqual(['/first-write', '/second-write'])
      expect(reached.filter(path => path === '/first-write')).toHaveLength(1)
      expect(reached).not.toContain('/second-write')
    } catch (error) {
      throw new Error(JSON.stringify({ reached, decisions }), { cause: error })
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 15_000)
  it('keeps read-only socket restrictions on auxiliary pages', async () => {
    const upgrades: string[] = [], refusals: string[] = []
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/' ? '<!doctype html><title>Useful service</title><main><h1>Useful service</h1><button onclick="window.open(\'/popup\',\'details\')">Open details</button></main>'
        : '<!doctype html><title>Details</title><main><h1>Useful details</h1></main><script>window.finished=false;const socket=new WebSocket("ws://"+location.host+"/socket");socket.onerror=socket.onclose=()=>window.finished=true;</script>')
    })
    server.on('upgrade', (request, socket) => { upgrades.push(request.url!); socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n') })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        readOnlyInteractions: true, deadline: Date.now() + 10_000, onSafetyRefusal: reason => refusals.push(reason) })
      const opened = session.page.context().waitForEvent('page')
      await session.page.getByRole('button', { name: 'Open details' }).click()
      const popup = await opened
      await popup.waitForFunction(() => (globalThis as unknown as { finished?: boolean }).finished)
      expect(upgrades).toEqual([])
      expect(refusals).toContain('protected_action_requires_fixture')
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 15_000)
  it('keeps concurrent context authority, headers and nested pages independent through closure', async () => {
    const reached: Array<{ path: string; owner?: string }> = []
    const admitted = { a: [] as string[], b: [] as string[] }
    const server = createServer((request, response) => {
      const path = new URL(request.url!, 'http://fixture.test').pathname
      reached.push({ path, owner: request.headers['x-preview'] as string | undefined })
      if (path === '/redirect') { response.writeHead(302, { location: '/popup' }); response.end(); return }
      if (path === '/worker.js') { response.setHeader('content-type', 'application/javascript'); response.end('fetch("/worker-denied").catch(()=>{}).finally(()=>postMessage("finished"))'); return }
      response.setHeader('content-type', 'text/html')
      response.end(path === '/' ? '<!doctype html><title>Useful service</title><main><h1>Useful service for your team</h1><button onclick="window.open(\'/redirect\',\'pricing\')">Open pricing</button></main>'
        : path === '/popup' || path === '/nested' ? '<!doctype html><title>Plans</title><main><h1>Plans for your team</h1><button onclick="window.open(\'/nested\',\'nested\')">Open details</button></main><script>window.finished=0;for(const url of ["/allowed-a","/allowed-b"])fetch(url).catch(()=>{}).finally(()=>window.finished++);new Worker("/worker.js").onmessage=()=>window.finished++;</script>'
          : '<!doctype html><title>Received</title><p>Controlled response</p>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const sessions: Array<Awaited<ReturnType<typeof createAuditPage>>> = []
    try {
      const browser = await getAuditBrowser()
      sessions.push(...await Promise.all((['a', 'b'] as const).map(owner => createAuditPage(browser, url + '/?owner=' + owner, {
        profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, deadline: Date.now() + 20_000,
        scanAccess: { origin: url, headers: { 'X-Preview': owner } },
        requestPolicy: async request => {
          const path = new URL(request.url).pathname
          admitted[owner].push(path)
          return path !== '/worker-denied' && (!path.startsWith('/allowed-') || path === '/allowed-' + owner)
        },
      }))))
      const popups = await Promise.all(sessions.map(async session => {
        const popup = session.page.context().waitForEvent('page')
        await session.page.getByRole('button', { name: 'Open pricing' }).click()
        const opened = await popup
        await opened.waitForFunction(() => (globalThis as unknown as { finished?: number }).finished === 3)
        return opened
      }))
      expect(reached.filter(row => row.path.startsWith('/allowed-'))).toEqual(expect.arrayContaining([
        { path: '/allowed-a', owner: 'a' }, { path: '/allowed-b', owner: 'b' },
      ]))
      expect(reached.filter(row => row.path.startsWith('/allowed-'))).toHaveLength(2)
      expect(reached.filter(row => row.path === '/redirect' || row.path === '/popup')).toEqual(expect.arrayContaining([
        { path: '/redirect', owner: 'a' }, { path: '/popup', owner: 'a' },
        { path: '/redirect', owner: 'b' }, { path: '/popup', owner: 'b' },
      ]))
      expect(reached.filter(row => row.path === '/worker-denied')).toEqual([])
      for (const owner of ['a', 'b'] as const) for (const path of ['/redirect', '/popup', '/allowed-a', '/allowed-b', '/worker.js', '/worker-denied'])
        expect(admitted[owner].filter(value => value === path), owner + ':' + path).toHaveLength(1)
      sessions[0].disposeNetwork(); await sessions[0].page.context().close()
      const nested = popups[1].context().waitForEvent('page')
      await popups[1].getByRole('button', { name: 'Open details' }).click()
      const opened = await nested
      await opened.waitForFunction(() => (globalThis as unknown as { finished?: number }).finished === 3)
      expect(reached.filter(row => row.path === '/allowed-a')).toHaveLength(1)
      expect(reached.filter(row => row.path === '/allowed-b')).toEqual([{ path: '/allowed-b', owner: 'b' }, { path: '/allowed-b', owner: 'b' }])
      expect(admitted.b.filter(path => path === '/allowed-b')).toHaveLength(2)
      expect(reached.filter(row => row.path === '/worker-denied')).toEqual([])
      await sessions[1].page.close()
      expect(await opened.evaluate(async () => {
        const allowed = await fetch('/allowed-b?after-owner-close').then(response => response.ok)
        const denied = await fetch('/allowed-a?after-owner-close').then(() => false, () => true)
        return allowed && denied
      })).toBe(true)
      expect(reached.filter(row => row.path === '/allowed-a')).toHaveLength(1)
      expect(reached.filter(row => row.path === '/allowed-b')).toHaveLength(3)
      expect(admitted.b.filter(path => path === '/allowed-b')).toHaveLength(3)
    } finally {
      await Promise.allSettled(sessions.map(async session => { session.disposeNetwork(); await session.page.context().close() }))
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 30_000)
  it('fails closed when caller authority throws during an auxiliary request', async () => {
    const reached: string[] = []
    const server = createServer((request, response) => {
      reached.push(request.url!)
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/' ? '<!doctype html><title>Useful service</title><main><h1>Useful service</h1><button onclick="window.open(\'/popup\',\'details\')">Open details</button></main>'
        : '<!doctype html><title>Details</title><main><h1>Useful details</h1></main><script>window.finished=false;fetch("/mutation",{method:"POST"}).catch(()=>{}).finally(()=>window.finished=true)</script>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        deadline: Date.now() + 10_000, requestPolicy: async request => {
          if (request.method === 'POST') throw new Error('Controlled authority lookup failure')
          return true
        } })
      const opened = session.page.context().waitForEvent('page')
      await session.page.getByRole('button', { name: 'Open details' }).click()
      await (await opened).waitForFunction(() => (globalThis as unknown as { finished?: boolean }).finished)
      expect(reached).not.toContain('/mutation')
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 15_000)
})
