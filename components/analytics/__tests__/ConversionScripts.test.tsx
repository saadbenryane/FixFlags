import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import { ANALYTICS_CONSENT_COPY } from '@/lib/marketing/copy'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_PREFERENCES_EVENT,
} from '@/lib/analytics/consent'

describe('ConversionScripts consent', () => {
  afterEach(() => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
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
    expect(dialog.className).toContain('top-3')
    expect(dialog.className).not.toContain('bottom-3')
    expect(document.documentElement.style.paddingTop).toBe('192px')
    dialog.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 12,
        top: 12,
        left: 0,
        right: 576,
        bottom: 280,
        width: 576,
        height: 268,
        toJSON() {
          return {}
        },
      }) as DOMRect
    fireEvent(window, new Event('resize'))
    expect(document.documentElement.style.paddingTop).toBe('296px')
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=denied`)
  })

  it('reopens preferences so an earlier choice can be changed', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    render(<ConversionScripts />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT))
    expect(await screen.findByRole('dialog', { name: 'Choose your analytics settings' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Allow analytics' }))

    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`)
  })
})
