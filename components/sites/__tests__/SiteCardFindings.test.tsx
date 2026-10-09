import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteCardFindings } from '../SiteCardFindings'
import type { SiteFlagSeed } from '@/lib/sites/coverage'

function flag(id: string, severity = 'IMPORTANT'): SiteFlagSeed {
  return { id, severity, problem: `Finding ${id}`, pageUrl: `https://example.com/page-${id}?private=not-shown`,
    improvementId: null, checkId: null, rubric: 'CONVERT', impactTag: null, evidence: 'Recorded evidence',
    whyItMatters: 'Context', fix: 'Fix it', status: 'OPEN', resolvedInId: null, area: 'conversion',
    affectedPaths: [`https://example.com/page-${id}?private=not-shown`], affectedPageCount: 1,
    priorityBand: severity === 'CRITICAL' ? 'fix_first' : 'other', priorityScore: severity === 'CRITICAL' ? 100 : 50,
    relatedOutcome: null, verificationState: 'unverified', latestOccurrenceAt: null }
}
describe('structured card findings', () => {
  it('leads with critical findings and keeps other priorities discoverable', () => {
    render(<SiteCardFindings siteId="s1" flags={[flag('a'), flag('b', 'CRITICAL')]} recommendations={[]} />)
    expect(screen.getByRole('tab', { name: 'Fix first 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: 'View Flag' })).toHaveAttribute('href', '/sites/s1/flags/b')
    expect(screen.queryByText('Finding a')).not.toBeInTheDocument()
    expect(screen.getByText('/page-b')).toBeVisible()
    expect(screen.queryByText(/private=not-shown/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Other Flags 1' }))
    expect(screen.getByRole('link', { name: 'View Flag' })).toBeVisible()
  })

  it('moves between priority tabs from the keyboard', () => {
    render(<SiteCardFindings siteId="s1" flags={[flag('a'), flag('b', 'CRITICAL')]} recommendations={[]} />)
    const fixFirst = screen.getByRole('tab', { name: 'Fix first 1' })
    fireEvent.keyDown(fixFirst, { key: 'ArrowRight' })
    const other = screen.getByRole('tab', { name: 'Other Flags 1' })
    expect(other).toHaveAttribute('aria-selected', 'true')
    expect(other).toHaveFocus()
    expect(screen.getByText('Finding a')).toBeVisible()
    fireEvent.keyDown(other, { key: 'Home' })
    expect(fixFirst).toHaveAttribute('aria-selected', 'true')
    expect(fixFirst).toHaveFocus()
  })
  it('bounds a large queue without hiding its count or losing findings', () => {
    render(<SiteCardFindings siteId="s1" flags={Array.from({ length: 7 }, (_, index) => flag(String(index)))} recommendations={[]} />)
    expect(screen.getAllByRole('link', { name: 'View Flag' })).toHaveLength(6)
    expect(screen.getByText('1–6 of 7')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getAllByRole('link', { name: 'View Flag' })).toHaveLength(1)
    expect(screen.getByText('Finding 6')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('Finding 0')).toBeVisible()
  })
  it('keeps suggestions distinct from evidence-backed Flags', () => {
    render(<SiteCardFindings siteId="s1" flags={[flag('f')]} recommendations={[flag('r', 'MINOR')]} />)
    expect(screen.getByText('Finding r')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Suggestions' })).toBeVisible()
  })
})
