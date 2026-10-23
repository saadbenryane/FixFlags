import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlagEvidenceDetails } from '../FlagEvidenceDetails'

describe('shared Flag evidence presentation', () => {
  it('retains every page observation while allowing caller-owned actions', () => {
    render(<FlagEvidenceDetails observed="Controls have no accessible name" expected="Each control has an accessible name"
      supportingObservations={[
        { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: 'https://example.com/',
          evidence: 'The menu action has no accessible name', recordedAt: null, references: [{ label: 'Menu', selector: '#menu', device: 'mobile' }] },
        { source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: 'https://example.com/pricing',
          evidence: 'The purchase action has no accessible name', recordedAt: null, references: [] },
      ]}><button type="button">Copy sample guidance</button></FlagEvidenceDetails>)
    expect(screen.getByText('Supporting observations')).toBeInTheDocument()
    expect(screen.getByText('The menu action has no accessible name')).toBeInTheDocument()
    expect(screen.getByText('The purchase action has no accessible name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy sample guidance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify fix' })).not.toBeInTheDocument()
  })

  it('explains missing evidence and avoids repeating a single observation', () => {
    render(<FlagEvidenceDetails observed={null} expected="The original condition must be observed again" />)
    expect(screen.getByText(/Evidence for this Flag was not stored/)).toBeInTheDocument()
    expect(screen.queryByText('Supporting observations')).not.toBeInTheDocument()
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
