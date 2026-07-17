import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renders the title as a heading', () => {
    render(<EmptyState title="No checks yet" />)
    expect(screen.getByRole('heading', { level: 3, name: 'No checks yet' })).toBeInTheDocument()
  })

  it('omits description, icon, and action slots when not provided', () => {
    const { container } = render(<EmptyState title="No checks yet" />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(screen.queryByTestId('empty-icon')).not.toBeInTheDocument()
  })

  it('renders description, icon, and action when provided', () => {
    render(
      <EmptyState
        title="No checks yet"
        description="Run your first check to see Flags here."
        icon={<svg data-testid="empty-icon" />}
        action={<button type="button">Check a URL</button>}
      />
    )
    expect(screen.getByText('Run your first check to see Flags here.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check a URL' })).toBeInTheDocument()
  })
})
