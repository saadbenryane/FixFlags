import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import SiteNotFound from '../not-found'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { CARE_HOME } from '@/lib/marketing/copy-barrel'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'

const mocks = vi.hoisted(() => ({ siteId: 'private-site' as string | null, pathname: '/sites/private-site', search: '',
  user: { id: 'owner', email: 'owner@example.invalid', name: 'Owner', plan: 'FREE' } as { id: string; email: string; name: string; plan: string } | null, isLoading: false }))
vi.mock('next/navigation', () => ({ useParams: () => ({ siteId: mocks.siteId }), usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search) }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: mocks.user, isLoading: mocks.isLoading }) }))
beforeEach(() => {
  mocks.siteId = 'private-site'; mocks.pathname = '/sites/private-site'; mocks.search = ''
  mocks.user = { id: 'owner', email: 'owner@example.invalid', name: 'Owner', plan: 'FREE' }; mocks.isLoading = false
  window.history.replaceState(null, '', '/sites/private-site')
})

it('keeps unavailable Site recovery in the app without repeating an unavailable root link', () => {
  render(<SiteNotFound />)
  expect(screen.getByRole('heading', { level: 1, name: SITE_WORKSPACE_COPY.unavailableTitle })).toBeVisible()
  expect(screen.getByText(SITE_WORKSPACE_COPY.unavailableBody)).toBeVisible()
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.allSites })).toHaveAttribute('href', '/dashboard')
  expect(screen.queryByRole('link', { name: SYSTEM_COPY.actions.siteHome })).not.toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('private-site')
})

it('returns an unavailable detail to its Site without exposing the requested record', () => {
  mocks.pathname = '/sites/private-site/flags/removed'
  render(<SiteNotFound />)
  expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.siteHome })).toHaveAttribute('href', '/sites/private-site')
  expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.allSites })).toHaveAttribute('href', '/dashboard')
  expect(screen.queryByRole('link', { name: CARE_HOME.signIn })).not.toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('removed')
})

it('lets signed-out visitors sign in for the exact unavailable detail without implying it exists', () => {
  mocks.user = null
  mocks.pathname = '/sites/private-site/outcomes/checkout'
  mocks.search = 'view=pages'
  window.history.replaceState(null, '', mocks.pathname + '?' + mocks.search + '#evidence')
  render(<SiteNotFound />)
  expect(within(screen.getByRole('main')).getByRole('link', { name: CARE_HOME.signIn, exact: true })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fprivate-site%2Foutcomes%2Fcheckout%3Fview%3Dpages%23evidence')
  expect(screen.getByText(SITE_WORKSPACE_COPY.unavailableBody)).toBeVisible()
  expect(screen.queryByRole('link', { name: SYSTEM_COPY.actions.siteHome })).not.toBeInTheDocument()
})

it('does not infer a signed-out session while account loading is unresolved', () => {
  mocks.user = null; mocks.isLoading = true
  render(<SiteNotFound />)
  expect(screen.queryByRole('link', { name: CARE_HOME.signIn, exact: true })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: SYSTEM_COPY.actions.allSites })).toHaveAttribute('href', '/dashboard')
})
