import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteDeployChecksPanel, SiteSignupSetupPanel } from '@/components/sites/SiteSettingsPanels'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))

describe('Site setup panels', () => {
  it('links the deploy hook to API keys and its guide', () => {
    render(<SiteDeployChecksPanel />)
    expect(screen.getByRole('heading', { name: S.deploy.title })).toBeVisible()
    expect(screen.getByRole('link', { name: S.deploy.keys })).toHaveAttribute('href', '/settings/api-keys')
    expect(screen.getByRole('link', { name: S.deploy.guide })).toHaveAttribute('href', '/docs/site-care#check-after-every-deploy')
  })

  it('gives owners the signup test setup with its three steps', () => {
    render(<SiteSignupSetupPanel siteId="site-1" fixtures={[]} />)
    expect(screen.getByRole('heading', { name: S.signupSetup })).toBeVisible()
    for (const step of C.fixtures.steps) expect(screen.getByText(step)).toBeVisible()
    expect(screen.getByRole('button', { name: C.fixtures.actions.add })).toBeVisible()
  })
})
