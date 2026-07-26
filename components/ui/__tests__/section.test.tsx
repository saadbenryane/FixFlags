import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Section } from '@/components/ui/section'

describe('Section', () => {
  it('uses the shared responsive marketing rhythm', () => {
    const { container } = render(<Section spacing="marketing" />)
    expect(container.firstElementChild).toHaveClass(
      'py-[var(--space-section-marketing)]'
    )
  })

  it('keeps hero block spacing in the shared primitive', () => {
    const { container } = render(<Section spacing="hero" />)
    expect(container.firstElementChild).toHaveClass(
      'pt-[var(--space-hero-start)]',
      'pb-[var(--space-hero-end)]'
    )
  })
})
