import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { SupportProvider, useSupportContext } from '../SupportProvider'

function Controls({ name }: { name: string }) {
  const support = useSupportContext()
  return <section aria-label={name}>
    <output>{JSON.stringify({ open: support.panelOpen, audit: support.auditId, session: support.sessionId, prefill: support.draftPrefill })}</output>
    <button onClick={() => support.openSupportChat({ auditId: 'chosen-audit', prefill: 'Recorded question' })}>Open</button>
    <button onClick={() => support.setPanelOpen(false)}>Close</button>
    <button onClick={() => support.setSessionId('retained-session')}>Retain session</button>
    <button onClick={() => support.setAuditIdOverride(null)}>Use page context</button>
    <button onClick={support.clearDraftPrefill}>Clear prefill</button>
  </section>
}

beforeEach(() => sessionStorage.clear())

describe('scoped support state', () => {
  it('preserves context, session and prefill through close and later page context changes', () => {
    const view = render(<SupportProvider auditId="page-one"><Controls name="Support" /></SupportProvider>)
    const state = () => JSON.parse(screen.getByRole('status').textContent!)
    fireEvent.click(screen.getByRole('button', { name: 'Open', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Retain session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }))
    expect(state()).toEqual({ open: false, audit: 'chosen-audit', session: 'retained-session', prefill: 'Recorded question' })
    expect(sessionStorage.getItem('ff_support_panel_open')).toBe('0')
    view.rerender(<SupportProvider auditId="page-two"><Controls name="Support" /></SupportProvider>)
    expect(state().audit).toBe('chosen-audit')
    fireEvent.click(screen.getByRole('button', { name: 'Use page context' }))
    expect(state().audit).toBe('page-two')
    fireEvent.click(screen.getByRole('button', { name: 'Clear prefill' }))
    expect(state().prefill).toBeNull()
    expect(state().session).toBe('retained-session')
  })

  it('keeps simultaneously mounted provider instances independent', () => {
    render(<><SupportProvider><Controls name="First" /></SupportProvider><SupportProvider><Controls name="Second" /></SupportProvider></>)
    fireEvent.click(within(screen.getByRole('region', { name: 'First' })).getByRole('button', { name: 'Open', exact: true }))
    expect(JSON.parse(within(screen.getByRole('region', { name: 'First' })).getByRole('status').textContent!).open).toBe(true)
    expect(JSON.parse(within(screen.getByRole('region', { name: 'Second' })).getByRole('status').textContent!).open).toBe(false)
  })

  it('renders a closed server snapshot and restores only the remembered client panel', () => {
    sessionStorage.setItem('ff_support_panel_open', '1')
    expect(renderToString(<SupportProvider><Controls name="Support" /></SupportProvider>)).toContain('&quot;open&quot;:false')
    render(<SupportProvider><Controls name="Support" /></SupportProvider>)
    expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ open: true, audit: null, session: null, prefill: null })
  })
})
