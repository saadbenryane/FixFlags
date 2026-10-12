import { describe, expect, it } from 'vitest'
import { validateMcpRequestOrigin } from '../request-origin'

function request(host: string, origin?: string, url = 'http://localhost:3145/api/mcp') {
  return new Request(url, { headers: { host, ...(origin ? { origin } : {}) } })
}
describe('MCP configured host and origin validation', () => {
  it('allows configured loopback aliases even when Next.js normalizes the request URL', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(validateMcpRequestOrigin(request(host + ':3145'), 'http://127.0.0.1:3145')).toBeUndefined()
      expect(validateMcpRequestOrigin(request(host + ':3145', 'http://' + host + ':3145'), 'http://127.0.0.1:3145')).toBeUndefined()
    }
  })
  it('does not trust an incoming Host or normalized request URL to expand production access', () => {
    for (const host of ['127.0.0.1', 'localhost', 'attacker.example'])
      expect(validateMcpRequestOrigin(request(host, undefined, 'https://' + host + '/api/mcp'), 'https://fixflags.com')?.status).toBe(403)
    expect(validateMcpRequestOrigin(request('fixflags.com', 'https://fixflags.com'), 'https://fixflags.com')).toBeUndefined()
  })
  it('rejects foreign origins, protocols and ports while supporting nonbrowser clients without Origin', () => {
    for (const origin of ['https://attacker.example', 'http://fixflags.com', 'https://fixflags.com:444', 'null'])
      expect(validateMcpRequestOrigin(request('fixflags.com', origin), 'https://fixflags.com')?.status).toBe(403)
    expect(validateMcpRequestOrigin(request('fixflags.com'), 'https://fixflags.com')).toBeUndefined()
    expect(validateMcpRequestOrigin(request('localhost:3145', 'http://localhost:9999'), 'http://localhost:3145')?.status).toBe(403)
  })
})
