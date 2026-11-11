import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlagEvidenceDetails } from '../FlagEvidenceDetails'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'

describe('shared Flag evidence presentation', () => {
  it('opens each measured hash route at its exact recorded address with a distinct accessible name', () => {
    const pricing = 'https://example.com/#/pricing'
    const checkout = 'https://example.com/#/checkout'
    render(<FlagEvidenceDetails observed={`${pricing}: LCP: 4s ${checkout}: LCP: 5s`} expected="LCP is under 2.5s" />)
    for (const url of [pricing, checkout]) {
      const link = screen.getByRole('link', { name: C.open(url) })
      expect(link).toHaveAttribute('href', url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(screen.getByText('/#/pricing')).toBeVisible()
    expect(screen.getByText('/#/checkout')).toBeVisible()
  })

  it('retains a credential-bearing historical observation as text without making it navigable', () => {
    render(<FlagEvidenceDetails observed="https://owner:secret@example.com/#/private: LCP: 4s https://example.com/#/public: LCP: 5s" expected="LCP is under 2.5s" />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('/#/private')).toBeVisible()
    expect(screen.getByText('4s')).toBeVisible()
    expect(screen.getByRole('link', { name: C.open('https://example.com/#/public') })).toHaveAttribute('href', 'https://example.com/#/public')
  })

  it('makes a single recorded target and observation time available without expanding the initial view', () => {
    render(<FlagEvidenceDetails observed="The purchase action has no accessible name" expected="The purchase action has an accessible name"
      supportingObservations={[
        { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: 'https://example.com/pricing',
          evidence: 'The purchase action has no accessible name', recordedAt: '2026-11-03T10:00:00Z', references: [{ label: 'Purchase', selector: '#purchase', device: 'mobile' }] },
      ]} />)
    const disclosure = screen.getByText('More evidence')
    const details = disclosure.closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByText(/#purchase/)).not.toBeVisible()
    fireEvent.click(disclosure)
    expect(screen.getByText(/#purchase/)).toBeVisible()
    expect(details.querySelector('time')).toHaveAttribute('dateTime', '2026-11-03T10:00:00Z')
  })

  it('does not add a disclosure for an identical observation without additional context', () => {
    render(<FlagEvidenceDetails observed="The action has no name" expected="The action has a name" supportingObservations={[
      { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: null, evidence: 'The action has no name', recordedAt: null, references: [] },
    ]} />)
    expect(screen.queryByText('More evidence')).not.toBeInTheDocument()
  })

  it('scales page measurement bars to the recorded values without inflating the smaller value', () => {
    render(<FlagEvidenceDetails observed="https://example.com/a: LCP: 1s https://example.com/b: LCP: 100s" expected="LCP is under 2.5s" />)
    const smaller = screen.getByRole('link', { name: C.open('https://example.com/a') }).closest('li')!
    const larger = screen.getByRole('link', { name: C.open('https://example.com/b') }).closest('li')!
    expect(smaller.querySelector('[style]')).toHaveStyle({ width: '1%' })
    expect(larger.querySelector('[style]')).toHaveStyle({ width: '100%' })
  })

  it('retains native repair alternatives as technical detail beside the recorded diagnosis', () => {
    const diagnostic = '#menu\nFix any of the following:\nElement does not have text that is visible to screen readers\n<button id="menu"></button>'
    render(<FlagEvidenceDetails observed={diagnostic} diagnosis="Buttons must have discernible text (1 element)" expected="The menu has an accessible name" />)
    expect(screen.getByText('Buttons must have discernible text (1 element)')).toBeVisible()
    const details = screen.getByText('Technical details').closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(details.querySelector('p')?.textContent).toBe(diagnostic)
  })
  it('retains every page observation while allowing caller-owned actions', () => {
    render(<FlagEvidenceDetails observed="Controls have no accessible name" expected="Each control has an accessible name"
      supportingObservations={[
        { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: 'https://example.com/',
          evidence: 'The menu action has no accessible name', recordedAt: null, references: [{ label: 'Menu', selector: '#menu', device: 'mobile' }] },
        { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: 'https://example.com/pricing',
          evidence: 'The purchase action has no accessible name', recordedAt: null, references: [] },
      ]}><button type="button">Copy sample guidance</button></FlagEvidenceDetails>)
    expect(screen.getByText('More evidence')).toBeInTheDocument()
    expect(screen.getByText('The menu action has no accessible name')).toBeInTheDocument()
    expect(screen.getByText('The purchase action has no accessible name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy sample guidance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify fix' })).not.toBeInTheDocument()
  })

  it('explains missing evidence and avoids repeating a single observation', () => {
    render(<FlagEvidenceDetails observed={null} expected="The original condition must be observed again" />)
    expect(screen.getByText(/Evidence for this Flag was not stored/)).toBeInTheDocument()
    expect(screen.queryByText('More evidence')).not.toBeInTheDocument()
  })
  it('ranks repeated page measurements and keeps the rest behind the full list', () => {
    render(<FlagEvidenceDetails observed={[
      'https://saadbenryane.com/journal/what-i-learned-about-branding-at-founder-institute: Mobile Largest Contentful Paint: 4.35s',
      'https://saadbenryane.com/work/global-biodiversity-platform: Mobile Largest Contentful Paint: 6.30s',
      'https://saadbenryane.com/journal/when-ai-codes-the-developer-role-shifts: Mobile Largest Contentful Paint: 4.05s',
      'https://saadbenryane.com/journal/a: Mobile Largest Contentful Paint: 5.10s',
      'https://saadbenryane.com/journal?tag=design: Mobile Largest Contentful Paint: 4.24s Observed on 5 pages.',
    ].join(' ')} expected="Mobile Largest Contentful Paint is under 2.5s" />)
    expect(screen.getByText('Mobile Largest Contentful Paint: 4.05s to 6.30s.')).toBeInTheDocument()
    expect(screen.getByText('Observed on 5 pages.')).toBeInTheDocument()
    const links = screen.getAllByRole('link').map(link => link.textContent)
    expect(links).toEqual([
      '/work/global-biodiversity-platform',
      '/journal/a',
      '/journal/what-i-learned-about-branding-at-founder-institute',
      '/journal?tag=design',
      '/journal/when-ai-codes-the-developer-role-shifts',
    ])
    expect(screen.getByText('View all 5 pages').closest('details')?.querySelector('a')?.textContent).toBe('/journal/when-ai-codes-the-developer-role-shifts')
  })

  it('keeps the representative evidence and explains why a new check is needed when support is unreadable', () => {
    render(<FlagEvidenceDetails observed="Two failed checks" expected="Checkout opens" supportingEvidenceUnreadable />)
    expect(screen.getByText('Two failed checks')).toBeInTheDocument()
    expect(screen.getByText(/supporting evidence could not be read/)).toBeInTheDocument()
    expect(screen.getByText(/Recheck the affected page/)).toBeInTheDocument()
  })

})
