import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DetectedToolsCard } from '../DetectedToolsCard'

vi.mock('next/image', () => ({ default: () => null }))

describe('detected tools overview', () => {
  it('counts the complete inventory and reveals tools beyond the four shown on the card', async () => {
    const names = ['Shopify', 'Next.js', 'Google Analytics', 'Stripe', 'React', 'Vercel', 'Sentry']
    render(<DetectedToolsCard items={names.map(name => ({ name, status: 'Detected', state: 'healthy' }))} />)
    const card = screen.getByRole('region', { name: 'Detected technologies' })
    expect(within(card).getByText('7')).toBeVisible()
    expect(within(card).getByText('Stripe')).toBeVisible()
    expect(within(card).getByText('+3 more')).toBeVisible()
    expect(within(card).queryByText('Sentry')).not.toBeInTheDocument()
    const trigger = within(card).getByRole('button', { name: 'View detected tools' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    for (const name of names) expect(within(dialog).getByText(name)).toBeVisible()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('omits a tools count when no tools were detected', () => {
    render(<DetectedToolsCard items={[]} />)
    expect(screen.queryByRole('region', { name: 'Detected technologies' })).not.toBeInTheDocument()
  })
})
