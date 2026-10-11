import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import { ANALYTICS_CONSENT_COPY } from '@/lib/marketing/copy'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_PREFERENCES_EVENT,
} from '@/lib/analytics/consent'
import { CLICK_IDS_COOKIE } from '@/lib/analytics/click-ids'

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <span data-testid="analytics-script" data-id={id} data-src={src} />
  ),
}))

describe('ConversionScripts consent', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-test')
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', 'pixel-test')
  })

  afterEach(() => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
    document.cookie = `${CLICK_IDS_COOKIE}=; Max-Age=0; Path=/`
    window.history.replaceState({}, '', '/')
    document.documentElement.style.paddingTop = ''
    document.documentElement.style.paddingBottom = ''
    vi.unstubAllEnvs()
  })

  it('explains the choice without calling the work a product journey', async () => {
    render(<ConversionScripts />)
    expect(ANALYTICS_CONSENT_COPY.body).toContain('see how people use FixFlags')
    expect(ANALYTICS_CONSENT_COPY.body.toLowerCase()).not.toMatch(/journey/)
    expect(await screen.findByText(ANALYTICS_CONSENT_COPY.body)).toBeVisible()
  })

  it('requires an explicit choice and remembers necessary-only', async () => {
    render(<ConversionScripts />)

    const dialog = await screen.findByRole('dialog', { name: 'Choose your analytics settings' })
    expect(dialog).toBeVisible()
    expect(dialog.className).toContain('bottom-[')
    expect(dialog.className).not.toContain('top-3')
    expect(dialog).toHaveAccessibleDescription(ANALYTICS_CONSENT_COPY.body)
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.documentElement.style.paddingBottom).toBe('')
    fireEvent(window, new Event('resize'))
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.documentElement.style.paddingBottom).toBe('')
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=denied`)
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })

  it('keeps visitor-specific consent out of the prerendered HTML', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    expect(renderToString(<ConversionScripts />)).toBe('')
  })

  it.each(['granted', 'denied'])('does not flash the prompt for a remembered %s choice', async (choice) => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${choice}; Path=/`
    render(<ConversionScripts />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryAllByTestId('analytics-script').length > 0).toBe(choice === 'granted')
    })
  })

  it('requests an explicit choice when the stored value is invalid', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=invalid; Path=/`
    render(<ConversionScripts />)
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })

  it('loads analytics and captures attribution only after allowing analytics', async () => {
    window.history.replaceState({}, '', '/?gclid=test-click')
    render(<ConversionScripts />)
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
    expect(document.cookie).not.toContain(CLICK_IDS_COOKIE)

    fireEvent.click(await screen.findByRole('button', { name: 'Allow analytics' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('analytics-script')).toHaveLength(3)
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`)
    expect(document.cookie).toContain(CLICK_IDS_COOKIE)
  })

  it('reopens preferences so an earlier choice can be changed', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    render(<ConversionScripts />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    expect(await screen.findByRole('dialog', { name: 'Choose your analytics settings' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Allow analytics' }))

    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`)
  })

  it('preserves page spacing when preferences reopen or are dismissed', async () => {
    document.documentElement.style.paddingTop = '17px'
    document.documentElement.style.paddingBottom = '23px'
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    render(<ConversionScripts />)

    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    expect(await screen.findByRole('dialog')).toBeVisible()
    fireEvent(window, new Event('resize'))
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    expect(document.documentElement.style.paddingTop).toBe('17px')
    expect(document.documentElement.style.paddingBottom).toBe('23px')
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })
})
