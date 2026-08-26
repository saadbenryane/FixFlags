import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/audit/FixPromptBlock', () => ({
  FixPromptBlock: ({ prompt }: { prompt: string }) => (
    <div data-testid="fix-prompt-preview">{prompt}</div>
  ),
}))

import { ReportFinishPlan } from '@/components/report/ReportFinishPlan'

const PROMPT = '## Mission\nFix all 2 issues.'

describe('ReportFinishPlan', () => {
  it('renders loading skeleton before flags arrive', () => {
    render(<ReportFinishPlan flagCount={0} prompt={null} loading />)
    expect(screen.getByLabelText('What to fix next')).toBeInTheDocument()
    expect(screen.getByText(/Finish Plan will appear/i)).toBeInTheDocument()
  })

  it('renders copy action for a bundled top fixes prompt', () => {
    render(<ReportFinishPlan flagCount={3} prompt={PROMPT} />)
    expect(screen.getByText(/3 Flags ranked by impact/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy all/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Preview prompt/i }))
    expect(screen.getByTestId('fix-prompt-preview')).toHaveTextContent('Fix all 2 issues')
  })

  it('shows locked teaser when prompts are gated', () => {
    render(<ReportFinishPlan flagCount={4} prompt={null} locked signUpHref="/sign-up" />)
    expect(screen.getByText(/Create a free account/i)).toBeInTheDocument()
  })
})
