import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PlanPrice } from '@/components/pricing/PlanPrice'

describe('PlanPrice', () => {
  it('renders currency in the display face with tabular numbers', () => {
    const { container } = render(<PlanPrice price="$0" />)
    const el = container.querySelector('span')
    expect(el).toHaveTextContent('$0')
    expect(el?.className).toMatch(/font-display/)
    expect(el?.className).toMatch(/tabular-nums/)
    expect(el?.className).not.toMatch(/font-mono/)
  })

  it('renders Waitlist in the display face without treating it as a number', () => {
    const { container } = render(<PlanPrice price="Waitlist" />)
    const el = container.querySelector('span')
    expect(el).toHaveTextContent('Waitlist')
    expect(el?.className).toMatch(/font-display/)
    expect(el?.className).not.toMatch(/tabular-nums/)
    expect(el?.className).not.toMatch(/font-mono/)
  })

  it('renders Volume in the display face without treating it as a number', () => {
    const { container } = render(<PlanPrice price="Volume" />)
    const el = container.querySelector('span')
    expect(el).toHaveTextContent('Volume')
    expect(el?.className).toMatch(/font-display/)
    expect(el?.className).not.toMatch(/tabular-nums/)
    expect(el?.className).not.toMatch(/font-mono/)
  })
})
