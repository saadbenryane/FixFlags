import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DetectedToolsCard } from '../DetectedToolsCard'

vi.mock('next/image', () => ({ default: () => null }))

describe('detected tools overview', () => {
  it('shows the complete inventory on the card and retains tool details', async () => {
    const names = ['Shopify', 'Next.js', 'Google Analytics', 'Stripe', 'React', 'Vercel', 'Sentry']
    render(<DetectedToolsCard items={names.map(name => ({ name, status: 'Detected', state: 'healthy' }))} />)
    const card = screen.getByRole('region', { name: 'Detected technologies' })
    expect(within(card).getByText('Detected tools')).toBeVisible()
    expect(within(card).queryByText('7')).not.toBeInTheDocument()
    expect(within(card).getByText('Stripe')).toBeVisible()
    expect(within(card).queryByText('+3 more')).not.toBeInTheDocument()
    expect(within(card).getByText('Sentry')).toBeVisible()
    const trigger = within(card).getByRole('button', { name: 'View detected tools' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    for (const name of names) {
      expect(within(dialog).getByText(name)).toBeVisible()
      expect(within(dialog).queryByRole('button', { name: `${name}: Detected` })).not.toBeInTheDocument()
      expect(within(dialog).getByText(name).closest('li')).toHaveTextContent('Detected')
    }
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('omits a tools count when no tools were detected', () => {
    render(<DetectedToolsCard items={[]} />)
    expect(screen.queryByRole('region', { name: 'Detected technologies' })).not.toBeInTheDocument()
  })

  it('retains an interactive tool when the caller supplies a destination', async () => {
    const onSelect = vi.fn()
    const tool = { name: 'Next.js', status: 'Detected in partial check', state: 'attention' as const }
    render(<DetectedToolsCard items={[tool]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'View detected tools' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next.js: Detected in partial check' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(tool)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
