import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequestDemoForm } from '@/components/marketing/demo/RequestDemoForm'
import { DEMO_PAGE } from '@/lib/marketing/copy/plans'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'

afterEach(() => vi.unstubAllGlobals())

describe('request a walkthrough', () => {
  it('preserves the plan-query API contract without presenting a plan picker', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    render(<RequestDemoForm initialPlan="TEAM" />)
    expect(screen.getByRole('heading', { name: PUBLIC_SITE_COPY.demo.title })).toBeVisible()
    expect(screen.queryByRole('group', { name: DEMO_PAGE.planLabel })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(DEMO_PAGE.siteCountLabel)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: PUBLIC_SITE_COPY.demo.sampleAction })).toHaveAttribute('href', '/samples')
    fireEvent.change(screen.getByLabelText(DEMO_PAGE.nameLabel), { target: { value: 'Operator' } })
    fireEvent.change(screen.getByLabelText(DEMO_PAGE.emailLabel), { target: { value: 'operator@example.com' } })
    fireEvent.change(screen.getByLabelText(DEMO_PAGE.websiteLabel), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: DEMO_PAGE.submitCta }))
    expect(await screen.findByRole('status')).toHaveTextContent(DEMO_PAGE.successTitle)
    expect(fetch).toHaveBeenCalledWith('/api/demo-request', expect.objectContaining({ body: expect.stringContaining('"plan":"TEAM"') }))
  })
})
