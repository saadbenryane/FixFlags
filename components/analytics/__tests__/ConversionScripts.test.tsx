import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_PREFERENCES_EVENT,
} from '@/lib/analytics/consent'

describe('ConversionScripts consent', () => {
  afterEach(() => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  })

  it('requires an explicit choice and remembers necessary-only', async () => {
    render(<ConversionScripts />)

    expect(await screen.findByRole('dialog', { name: 'Choose your analytics settings' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
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
