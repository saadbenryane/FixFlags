import { createServer } from 'node:http'
import { expect, it } from 'vitest'
import { isDemoDevServerRunning } from '../audit-demo-fixtures'

async function probe(html: string) {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html')
    response.end(html)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture server address unavailable')
    return await isDemoDevServerRunning(`http://127.0.0.1:${address.port}`)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

it('refuses an unrelated application that returns HTTP 200 for every route', async () => {
  expect(await probe('<!doctype html><html><title>Another application</title><main>Welcome</main></html>')).toBe(false)
})

it('recognizes the actual demo fixture independently of a shared localhost port', async () => {
  expect(await probe('<!doctype html><html><main data-fixflags-demo="original">Demo</main></html>')).toBe(true)
})
