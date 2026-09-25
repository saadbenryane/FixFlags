import { describe, expect, it } from 'vitest'
import {
  audienceMatches,
  credentialAllows,
  pkceChallenge,
  pkceMatches,
  protectedResourceDocument,
  wwwAuthenticate,
} from '@/lib/mcp/oauth'

describe('MCP OAuth contract', () => {
  it('binds tokens to the canonical MCP resource', () => {
    const resource = protectedResourceDocument().resource
    const url = new URL(resource)
    expect(audienceMatches(`${url.protocol.toUpperCase()}//${url.host.toUpperCase()}${url.pathname}`, resource)).toBe(true)
    expect(audienceMatches('https://evil.example/api/mcp', resource)).toBe(false)
  })

  it('lets a first-party key through and enforces OAuth scopes', () => {
    expect(credentialAllows({ audience: null, scopes: [] }, 'sites:run')).toBe(true)
    expect(credentialAllows({ audience: 'https://fixflags.com/api/mcp', scopes: ['sites:read'] }, 'sites:run')).toBe(false)
    expect(credentialAllows({ audience: 'https://fixflags.com/api/mcp', scopes: ['sites:run'] }, 'sites:read')).toBe(true)
  })

  it('checks PKCE S256 and publishes the resource metadata challenge', () => {
    const verifier = 'a'.repeat(50)
    const challenge = pkceChallenge(verifier)
    expect(pkceMatches(verifier, challenge)).toBe(true)
    expect(pkceMatches(`${verifier}x`, challenge)).toBe(false)
    expect(wwwAuthenticate({ error: 'invalid_token' })).toContain('resource_metadata=')
    expect(wwwAuthenticate({ error: 'insufficient_scope', scope: 'sites:run' })).toContain('error="insufficient_scope"')
  })
})
