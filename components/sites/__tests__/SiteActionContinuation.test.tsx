import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReportAuthGateProvider } from '@/components/auth/ReportAuthGate'
import { SiteActionContinuation, SitePromptAccessActions } from '../SiteActionContinuation'
import { useSiteNavigationContinuity } from '@/hooks/useSiteNavigationContinuity'
import { SITE_CONTINUATION_PREFIX } from '@/lib/sites/navigation-continuity'

vi.mock('next/navigation', () => ({ usePathname: () => '/sites/p_creator' }))
vi.mock('@/components/auth/AuthFlow', () => ({ AuthFlow: ({ nextPath, auditId }: { nextPath?: string; auditId?: string }) =>
  <form aria-label="Authentication" data-next-path={nextPath} data-audit-id={auditId}><label>Email<input type="email" /></label></form>,
}))

function Actions() {
  useSiteNavigationContinuity('p_creator')
  return <ReportAuthGateProvider auditId="creator-audit">
    <SiteActionContinuation availability="sign_in" destination="/sites/p_creator" action="check" />
    <SitePromptAccessActions availability="sign_in" destination="/sites/p_creator" label="Copy all fix prompts" />
  </ReportAuthGateProvider>
}

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('signed-out Site actions', () => {
  it.each(['Check again', 'Copy all fix prompts', 'View prompt'])('opens authentication from %s without running a protected action', async label => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    window.history.replaceState({}, '', '/sites/p_creator?category=performance#flags')
    render(<Actions />)
    const action = screen.getByRole('button', { name: label, exact: true })
    // Safari can activate a button without focusing it first.
    expect(document.activeElement).not.toBe(action)
    fireEvent.click(action)
    const dialog = await screen.findByRole('dialog')
    const form = await within(dialog).findByRole('form', { name: 'Authentication' })
    expect(form).toHaveAttribute('data-next-path', '/sites/p_creator?category=performance#flags')
    expect(form).toHaveAttribute('data-audit-id', 'creator-audit')
    const key = SITE_CONTINUATION_PREFIX + '/sites/p_creator'
    expect(sessionStorage.getItem(key)).not.toBeNull()
    expect(request).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(action).toHaveFocus())
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(window.location.search + window.location.hash).toBe('?category=performance#flags')
    expect(request).not.toHaveBeenCalled()
  })
})
