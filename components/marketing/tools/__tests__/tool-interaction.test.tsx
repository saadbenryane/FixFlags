import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetaPreviewClient } from '@/components/marketing/tools/MetaPreviewClient'
import { PlaceholderDetectorClient } from '@/components/marketing/tools/PlaceholderDetectorClient'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { SYSTEM_COPY, TOOLS } from '@/lib/marketing/copy'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => null }))

const submittedUrl = 'https://private.example/customer?email=private@example.com'
const privateContent = 'private submitted page content'
const privateError = `Could not fetch ${submittedUrl}`
const metaResult = {
  url: submittedUrl, title: privateContent, description: null, ogImage: null,
  ogTitle: null, ogDescription: null, twitterCard: null, twitterImage: null,
  favicon: null, hasCanonical: false, hasRobots: false, statusCode: 200, error: null,
}
const placeholderResult = {
  url: submittedUrl,
  matches: [{ type: 'placeholder', label: 'TODO marker', match: 'TODO', context: privateContent }],
  totalFound: 1, error: null,
}
const tools = [
  { slug: 'meta-preview', Component: MetaPreviewClient, result: metaResult },
  { slug: 'placeholder-detector', Component: PlaceholderDetectorClient, result: placeholderResult },
] as const

function toolEvents() {
  return (window.dataLayer ?? [])
    .map((command) => Array.from(command as IArguments))
    .filter(([command, name]) => command === 'event' && name === 'tool_interaction')
    .map(([, , params]) => params as Record<string, unknown>)
}

function submit() {
  const input = screen.getByRole('textbox', { name: 'Website URL' })
  fireEvent.change(input, { target: { value: submittedUrl } })
  fireEvent.submit(input.closest('form')!)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  delete (window as { dataLayer?: unknown[] }).dataLayer
  delete (window as { gtag?: (...args: unknown[]) => void }).gtag
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  sessionStorage.clear()
})

describe.each(tools)('$slug acquisition lifecycle', ({ slug, Component, result }) => {
  it.each([
    { outcome: 'succeeded', kind: 'success' },
    { outcome: 'application_error', kind: 'application' },
    { outcome: 'api_error', kind: 'api' },
    { outcome: 'network_error', kind: 'network' },
    { outcome: 'response_error', kind: 'invalid-json' },
  ])('records submitted and $outcome once with no submitted content', async ({ outcome, kind }) => {
    const fetchMock = vi.fn()
    if (kind === 'network') fetchMock.mockRejectedValue(new Error(privateError))
    else if (kind === 'invalid-json') fetchMock.mockResolvedValue(new Response('invalid json'))
    else fetchMock.mockResolvedValue(new Response(JSON.stringify(
      kind === 'api' ? { message: 'Request rejected' }
        : kind === 'application' ? { ...result, matches: [], totalFound: 0, error: privateError }
          : result,
    ), { status: kind === 'api' ? 429 : 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<Component />)

    submit()

    await waitFor(() => expect(toolEvents()).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(toolEvents().map((event) => event.outcome)).toEqual(['submitted', outcome])
    for (const event of toolEvents()) {
      expect(event).toEqual({
        tool: slug, outcome: event.outcome, journey_id: expect.any(String),
        device: 'desktop', send_to: 'G-TEST12345',
      })
      expect(isAnalyticsJourneyId(event.journey_id)).toBe(true)
    }
    expect(toolEvents()[0].journey_id).toBe(toolEvents()[1].journey_id)
    expect(JSON.stringify(toolEvents())).not.toContain(submittedUrl)
    expect(JSON.stringify(toolEvents())).not.toContain(privateContent)
    expect(JSON.stringify(toolEvents())).not.toContain(privateError)
    if (kind === 'success') expect(screen.getAllByText(privateContent).length).toBeGreaterThan(0)
    else {
      expect(screen.queryByText(privateContent)).not.toBeInTheDocument()
      expect(screen.queryByText(TOOLS.placeholderDetector.noIssuesHeading)).not.toBeInTheDocument()
      expect(screen.queryByText(TOOLS.metaPreview.socialPreviewHeading)).not.toBeInTheDocument()
      expect(screen.getByText(kind === 'api' ? 'Request rejected' : SYSTEM_COPY.errors.genericRetry)).toBeInTheDocument()
      expect(screen.queryByText(privateError)).not.toBeInTheDocument()
    }
    view.rerender(<Component />)
    expect(toolEvents()).toHaveLength(2)
  })

  it('keeps a pending submission distinct from its terminal result', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve })))
    render(<Component />)
    submit()
    expect(toolEvents().map((event) => event.outcome)).toEqual(['submitted'])
    finish(new Response(JSON.stringify(result)))
    await waitFor(() => expect(toolEvents().map((event) => event.outcome)).toEqual(['submitted', 'succeeded']))
  })

  it('does not emit telemetry or create a journey without consent', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result))))
    render(<Component />)
    submit()
    await screen.findAllByText(privateContent)
    expect(toolEvents()).toEqual([])
    expect(sessionStorage.length).toBe(0)
  })

  it('does not record blank validation as an actual submission', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<Component />)
    fireEvent.submit(screen.getByRole('textbox', { name: 'Website URL' }).closest('form')!)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(toolEvents()).toEqual([])
    expect(screen.getByText('Enter a URL')).toBeInTheDocument()
  })
})

it('treats a completed placeholder inspection with zero matches as success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    url: submittedUrl, matches: [], totalFound: 0, error: null,
  }))))
  render(<PlaceholderDetectorClient />)
  submit()
  await screen.findByText(TOOLS.placeholderDetector.noIssuesHeading)
  expect(toolEvents().map((event) => event.outcome)).toEqual(['submitted', 'succeeded'])
})
