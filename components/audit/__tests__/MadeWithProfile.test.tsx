import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'

const profile: TechnologyProfile = {
  status: 'complete',
  detectorVersion: '2026.07.23.1',
  detectedAt: '2026-07-23T10:00:00.000Z',
  technologies: [
    {
      slug: 'next-js',
      name: 'Next.js',
      category: 'framework',
      confidenceBand: 'verified',
      evidence: [{ type: 'resource', label: 'Next.js assets under /_next/' }],
    },
    {
      slug: 'vercel',
      name: 'Vercel',
      category: 'hosting',
      confidenceBand: 'verified',
      evidence: [{ type: 'header', label: 'Vercel response header' }],
    },
  ],
  insight: 'On this Next.js and Vercel site, Experience is the lowest-scoring rubric at 68 with 4 unresolved Flags.',
  recheckDiff: {
    added: ['Vercel'],
    removed: [],
    confidenceChanged: [],
  },
}

describe('MadeWithProfile', () => {
  it('shows a compact summary and expandable evidence without grading vendors', () => {
    render(<MadeWithProfile profile={profile} />)

    expect(screen.getByRole('heading', { name: 'Made with' })).toBeInTheDocument()
    expect(screen.getAllByText('Next.js').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vercel').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Next\.js score/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('View stack and evidence'))
    expect(screen.getByText('Next.js assets under /_next/')).toBeInTheDocument()
    expect(screen.getByText('Added: Vercel')).toBeInTheDocument()
    expect(screen.getByText(/score reflects the site outcome/i)).toBeInTheDocument()
  })

  it.each([
    ['not_captured', 'Technology signals were not captured for this review'],
    ['unavailable', 'Technology signals were unavailable for this check'],
    ['complete', 'No technologies could be verified'],
  ] as const)('renders the %s state explicitly', (status, expected) => {
    render(
      <MadeWithProfile
        profile={{
          status,
          detectorVersion: null,
          detectedAt: null,
          technologies: [],
          insight: null,
        }}
      />
    )
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument()
  })

  it('labels historical evidence as partial', () => {
    render(<MadeWithProfile profile={{ ...profile, status: 'partial' }} />)
    expect(screen.getByText(/Partial profile/i)).toBeInTheDocument()
  })
})
