import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicLink, PublicDisclosure } from '../PublicInteraction'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'
import { ensureGtagStub } from '@/lib/analytics/gtag'

afterEach(() => {
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  delete window.dataLayer
  delete window.gtag
  vi.unstubAllEnvs()
})

describe('public interaction measurement', () => {
  it('respects consent and never includes the query or user URL in navigation events', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST')
    window.history.replaceState({}, '', '/coverage?url=https://private.example')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    ensureGtagStub()
    render(<PublicLink href="/new" target="analyze" onClick={event => event.preventDefault()}>Analyze</PublicLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Analyze' }))
    expect(window.dataLayer).toEqual([])
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    fireEvent.click(screen.getByRole('link', { name: 'Analyze' }))
    const event = window.dataLayer!.at(-1) as unknown[]
    expect(event[1]).toBe('marketing_interaction')
    expect(event[2]).toMatchObject({ page: '/coverage', action: 'navigate', target: 'analyze' })
    expect(JSON.stringify(event)).not.toContain('private.example')
  })

  it('does not measure account or private Site routes through the shared footer', () => {
    window.history.replaceState({}, '', '/sites/private-site')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    ensureGtagStub()
    render(<PublicLink href="/docs" target="docs" onClick={event => event.preventDefault()}>Docs</PublicLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Docs' }))
    expect(window.dataLayer).toEqual([])
  })

  it('measures exploration only when a public detail opens', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST')
    window.history.replaceState({}, '', '/coverage')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    ensureGtagStub()
    const { container } = render(<PublicDisclosure page="/coverage" target="conversion" summary="Explore">Details</PublicDisclosure>)
    const details = container.querySelector('details')!
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect((window.dataLayer!.at(-1) as unknown[])[2]).toMatchObject({ action: 'expand', target: 'conversion' })
  })
})
