import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SiteError from '@/app/sites/[siteId]/error'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

const { siteParams } = vi.hoisted(() => ({ siteParams: { current: 'p_site-1' as string | null } }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ siteId: siteParams.current }),
  usePathname: () => '/sites/p_site-1',
}))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: null }) }))

describe('Site error recovery', () => {
  it('keeps the Site path and offers a separate all-Sites escape', () => {
    siteParams.current = 'p_site-1'
    const reset = vi.fn()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<SiteError error={new Error('load failed')} reset={reset} />)

    expect(screen.getByText(SYSTEM_COPY.errors.site.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.siteHome })).toHaveAttribute('href', '/sites/p_site-1')
    expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.allSites })).toHaveAttribute('href', '/dashboard')
    fireEvent.click(screen.getByRole('button', { name: SYSTEM_COPY.actions.retry }))
    expect(reset).toHaveBeenCalledOnce()
    logged.mockRestore()
  })

  it('falls back to all Sites if the route has no usable Site id', () => {
    siteParams.current = null
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<SiteError error={new Error('load failed')} reset={vi.fn()} />)
    expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.allSites })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: SYSTEM_COPY.actions.siteHome })).not.toBeInTheDocument()
    logged.mockRestore()
  })
})
