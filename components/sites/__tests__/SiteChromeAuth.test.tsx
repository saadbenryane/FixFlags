import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteChromeAuth } from '../SiteChromeAuth'

vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: null, isLoading: false }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/sites/site-return', useSearchParams: () => new URLSearchParams(window.location.search) }))
afterEach(() => window.history.replaceState({}, '', '/'))
describe('workspace authentication destination', () => {
  it('preserves the selected category in the actual sign-in link', () => {
    window.history.replaceState({}, '', '/sites/site-return?category=accessibility')
    render(<SiteChromeAuth />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite-return%3Fcategory%3Daccessibility')
  })
  it('preserves Timeline and its fragment through the same link', () => {
    window.history.replaceState({}, '', '/sites/site-return?view=timeline#timeline')
    render(<SiteChromeAuth />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite-return%3Fview%3Dtimeline%23timeline')
  })
})
