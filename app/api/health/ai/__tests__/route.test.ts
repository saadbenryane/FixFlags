import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getAiProviderHealth = vi.hoisted(() => vi.fn())
const validateAiProviderCredentials = vi.hoisted(() => vi.fn())

vi.mock('@/lib/audit/health/ai-providers', () => ({
  getAiProviderHealth,
  validateAiProviderCredentials,
}))
vi.mock('@/lib/audit/judge-triage-schema', () => ({
  QUALITY_TRIAGE_SCHEMA_OPENAI: { properties: {} },
}))

const { GET } = await import('../route')

const HEALTH = {
  configured: true,
  providerChain: ['openai', 'anthropic'],
  configuredProviders: ['openai'],
  openai: true,
  anthropic: true,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/health/ai', () => {
  it('reports the provider health without validating credentials by default', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)

    const response = await GET(new NextRequest('https://example.com/api/health/ai'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.ai).toEqual(HEALTH)
    expect(body.triageSchemaLoaded).toBe(true)
    expect(body.credentialValidation).toBe('not_checked')
    expect(validateAiProviderCredentials).not.toHaveBeenCalled()
  })

  it('marks the probe unhealthy when providers are not configured', async () => {
    getAiProviderHealth.mockReturnValue({ ...HEALTH, configured: false })

    const response = await GET(new NextRequest('https://example.com/api/health/ai'))
    const body = await response.json()
    expect(body.ok).toBe(false)
  })

  it('runs a live credential check when ?validate=1', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)
    validateAiProviderCredentials.mockResolvedValueOnce({ ok: true, provider: 'openai' })

    const response = await GET(
      new NextRequest('https://example.com/api/health/ai?validate=1')
    )
    const body = await response.json()
    expect(validateAiProviderCredentials).toHaveBeenCalledTimes(1)
    expect(body.credentialValidation).toBe('valid')
    expect(body.validation).toEqual({ ok: true, provider: 'openai' })
    expect(body.validatedAt).toEqual(expect.any(String))
  })

  it('reports invalid credentials and an unhealthy probe', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)
    validateAiProviderCredentials.mockResolvedValueOnce({
      ok: false,
      provider: 'openai',
      error: 'OPENAI_API_KEY is not configured',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/health/ai?validate=1')
    )
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.credentialValidation).toBe('invalid')
    expect(body.validation?.error).toContain('OPENAI_API_KEY')
  })

  it('returns 503 when the probe handler itself throws', async () => {
    getAiProviderHealth.mockImplementation(() => {
      throw new Error('boom')
    })

    const response = await GET(new NextRequest('https://example.com/api/health/ai'))
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.ok).toBe(false)
  })
})
