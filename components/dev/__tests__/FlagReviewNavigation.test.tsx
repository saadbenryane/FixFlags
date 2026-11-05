import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlagReviewNavigation } from '@/components/sites/PageFlagReview'

const flags = Array.from({ length: 8 }, (_, index) => ({ id: `flag-${index}`, title: `Recorded Flag ${index + 1}` }))

function Review() {
  const [index, setIndex] = useState(0)
  return <>
    <FlagReviewNavigation flags={flags} index={index} onChange={setIndex} panelId="review-panel" />
    <section id="review-panel" aria-label="Current Flag">{flags[index].title}</section>
  </>
}

describe('page Flag navigation', () => {
  it('reaches all eight Flags in order and preserves the page boundary', () => {
    render(<Review />)
    const next = screen.getByRole('button', { name: 'Next Flag' })
    expect(screen.getByRole('button', { name: 'Previous Flag' })).toHaveAttribute('aria-disabled', 'true')
    next.focus()
    for (let index = 0; index < flags.length; index++) {
      expect(screen.getByRole('status')).toHaveTextContent(`${index + 1} of 8`)
      expect(screen.getByRole('region')).toHaveTextContent(flags[index].title)
      if (index < flags.length - 1) fireEvent.click(next)
    }
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveFocus()
    fireEvent.click(next)
    expect(screen.getByRole('status')).toHaveTextContent('8 of 8')
    fireEvent.click(screen.getByRole('button', { name: 'Previous Flag' }))
    expect(screen.getByRole('region')).toHaveTextContent('Recorded Flag 7')
  })

  it('lets the user jump directly to any Flag without stepping through earlier ones', () => {
    render(<Review />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose a Flag' }), { target: { value: '5' } })
    expect(screen.getByRole('status')).toHaveTextContent('6 of 8')
    expect(screen.getByRole('region')).toHaveTextContent('Recorded Flag 6')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-controls', 'review-panel')
  })

  it('keeps every recorded title available in the native jump control', () => {
    render(<Review />)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(flags.map((flag, index) => `Flag ${index + 1}: ${flag.title}`))
    expect(screen.getByRole('combobox')).toHaveValue('0')
  })
})
