import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FaqSection } from '@/components/marketing/FaqSection'
import type { FaqEntry } from '@/lib/marketing/copy/faq'

const ITEMS: readonly FaqEntry[] = [
  {
    question: 'Is FixFlags free?',
    answer: 'Yes. One website is free, with 24/7 monitoring checked every 24 hours.',
    learnMore: { href: '/help/billing-and-plans/free-vs-pro', label: 'Free vs Pro' },
  },
  {
    question: 'What is a Flag?',
    answer: 'A Flag is something important that needs attention, with evidence.',
    learnMore: { href: '/help/checks-and-reports/scores-and-severity', label: 'Reading Flags' },
  },
]

describe('FaqSection', () => {
  it('keeps the open answer inside the item and uses a branded live link', () => {
    render(<FaqSection items={ITEMS} title="" sectionLabel={null} defaultOpenFirst />)

    const item = document.getElementById('is-fixflags-free')
    expect(item).toHaveClass('rounded-card')
    expect(item).not.toHaveClass('rounded-full')
    expect(item).not.toHaveClass('overflow-hidden')

    const link = screen.getByRole('link', { name: 'Free vs Pro' })
    expect(link).toHaveAttribute('href', '/help/billing-and-plans/free-vs-pro')
    expect(link).toHaveClass('text-brand')
    expect(link).not.toHaveClass('text-link')
  })

  it('opens later questions onto live branded links', () => {
    render(<FaqSection items={ITEMS} title="" sectionLabel={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'What is a Flag?' }))
    const link = screen.getByRole('link', { name: 'Reading Flags' })
    expect(link).toHaveAttribute('href', '/help/checks-and-reports/scores-and-severity')
    expect(link).toHaveClass('text-brand')
  })
})
