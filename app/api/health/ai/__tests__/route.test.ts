import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const getAiProviderHealth = vi.hoisted(() => vi.fn())
const validateAiProviderCredentials = vi.hoisted(() => vi.fn())
const requireAdmin = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin,
  isAdminResponse: (value: unknown) => value instanceof NextResponse,
}))

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

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')
  vi.stubEnv('BETTER_AUTH_URL', 'https://example.com')
  requireAdmin.mockResolvedValue({ id: 'admin', role: 'admin' })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
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
    expect(requireAdmin).not.toHaveBeenCalled()
  })

  it('marks the probe unhealthy when providers are not configured', async () => {
    getAiProviderHealth.mockReturnValue({ ...HEALTH, configured: false })

    const response = await GET(new NextRequest('https://example.com/api/health/ai'))
    const body = await response.json()
    expect(body.ok).toBe(false)
  })

  it('runs a live credential check for a current administrator from the trusted origin', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)
    validateAiProviderCredentials.mockResolvedValueOnce({ ok: true, provider: 'openai' })

    const response = await GET(
      new NextRequest('https://example.com/api/health/ai?validate=1', { headers: { origin: 'https://example.com' } })
    )
    const body = await response.json()
    expect(validateAiProviderCredentials).toHaveBeenCalledTimes(1)
    expect(body.credentialValidation).toBe('valid')
    expect(body.validation).toEqual({ ok: true, provider: 'openai' })
    expect(body.validatedAt).toEqual(expect.any(String))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each([401, 403, 503])('refuses live validation when administrator admission returns %s', async status => {
    requireAdmin.mockResolvedValueOnce(NextResponse.json({ message: 'Admission refused' }, { status }))
    const response = await GET(new NextRequest('https://example.com/api/health/ai?validate=1', {
      headers: { origin: 'https://example.com' },
    }))
    expect(response.status).toBe(status)
    expect(validateAiProviderCredentials).not.toHaveBeenCalled()
    expect(getAiProviderHealth).not.toHaveBeenCalled()
  })

  it.each([undefined, 'https://attacker.invalid'])('refuses missing or foreign origins before administrator or provider work: %s', async origin => {
    const response = await GET(new NextRequest('https://example.com/api/health/ai?validate=1', {
      headers: origin ? { origin } : {},
    }))
    expect(response.status).toBe(403)
    expect(requireAdmin).not.toHaveBeenCalled()
    expect(validateAiProviderCredentials).not.toHaveBeenCalled()
  })

  it('reports invalid credentials and an unhealthy probe', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)
    validateAiProviderCredentials.mockResolvedValueOnce({
      ok: false,
      provider: 'openai',
      failure: 'authentication_rejected',
      error: '401 Authentication rejected',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/health/ai?validate=1', { headers: { origin: 'https://example.com' } })
    )
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.credentialValidation).toBe('invalid')
    expect(body.validation?.error).toContain('401')
  })

  it('keeps provider quota failure distinct from invalid credentials', async () => {
    getAiProviderHealth.mockReturnValue(HEALTH)
    validateAiProviderCredentials.mockResolvedValueOnce({ ok: false, provider: 'openai', failure: 'rate_limited' })
    const response = await GET(new NextRequest('https://example.com/api/health/ai?validate=1', {
      headers: { origin: 'https://example.com' },
    }))
    expect(await response.json()).toMatchObject({ ok: false, credentialValidation: 'unavailable',
      validation: { failure: 'rate_limited' } })
  })

  it('does not claim credential validation when no provider is configured', async () => {
    getAiProviderHealth.mockReturnValue({ ...HEALTH, configured: false })
    validateAiProviderCredentials.mockResolvedValueOnce(null)
    const response = await GET(new NextRequest('https://example.com/api/health/ai?validate=1', {
      headers: { origin: 'https://example.com' },
    }))
    expect(await response.json()).toMatchObject({ ok: false, credentialValidation: 'not_configured' })
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
