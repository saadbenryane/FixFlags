import { describe, expect, it } from 'vitest'
import { extractMcpCredential } from '@/lib/mcp/auth'

describe('MCP credential extraction', () => {
  it('accepts a Bearer API key', () => {
    const result = extractMcpCredential(
      new Headers({ Authorization: 'Bearer ff_live_example' })
    )
    expect(result).toEqual({
      ok: true,
      key: 'ff_live_example',
      scheme: 'bearer',
    })
  })

  it('accepts the permanent x-api-key scheme', () => {
    const result = extractMcpCredential(
      new Headers({ 'x-api-key': 'ff_live_example' })
    )
    expect(result).toEqual({
      ok: true,
      key: 'ff_live_example',
      scheme: 'x-api-key',
    })
  })

  it('accepts matching credentials in both supported headers', () => {
    const result = extractMcpCredential(
      new Headers({
        Authorization: 'Bearer ff_live_example',
        'x-api-key': 'ff_live_example',
      })
    )
    expect(result).toMatchObject({ ok: true, key: 'ff_live_example' })
  })

  it('rejects conflicting credentials', () => {
    const result = extractMcpCredential(
      new Headers({
        Authorization: 'Bearer ff_live_one',
        'x-api-key': 'ff_live_two',
      })
    )
    expect(result).toMatchObject({
      ok: false,
      code: 'CONFLICTING_API_KEYS',
    })
  })

  it('rejects malformed authorization and missing credentials', () => {
    expect(
      extractMcpCredential(new Headers({ Authorization: 'Basic abc' }))
    ).toMatchObject({ ok: false, code: 'INVALID_AUTHORIZATION' })
    expect(extractMcpCredential(new Headers())).toMatchObject({
      ok: false,
      code: 'MISSING_API_KEY',
    })
  })
})
