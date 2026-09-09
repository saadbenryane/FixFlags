import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BoardDetails } from '../BoardDetails'

describe('card evidence', () => {
  it('shows recorded page scope and preserves partial and failed results', () => {
    render(<BoardDetails checkedAt="2026-09-08T12:00:00Z" sources={['FixFlags browser']} image={{ src: '/api/screenshots/audit/desktop', alt: 'Actual captured page' }} pages={[
      { url: 'https://example.com/', title: 'Home', status: 'COMPLETED' },
      { url: 'https://example.com/contact', title: 'Contact', status: 'PARTIAL' },
      { url: 'https://example.com/shop', title: 'Shop', status: 'FAILED' },
    ]} />)
    expect(screen.getByRole('img', { name: 'Actual captured page' })).toHaveAttribute('src', '/api/screenshots/audit/desktop')
    expect(screen.getByText('Checked')).toBeInTheDocument()
    expect(screen.getByText('Partial')).toBeInTheDocument()
    expect(screen.getByText('Could not check')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Contact/ })).toHaveAttribute('href', 'https://example.com/contact')
  })
  it('does not invent checked pages or freshness when neither exists', () => {
    render(<BoardDetails pages={[]} />)
    expect(screen.getByText('No page-level results were recorded for this check.')).toBeInTheDocument()
    expect(screen.getByText('No completed check recorded yet.')).toBeInTheDocument()
    expect(screen.queryByText('Checked')).not.toBeInTheDocument()
  })
})
