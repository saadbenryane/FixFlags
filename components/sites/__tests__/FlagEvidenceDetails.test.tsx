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
})
