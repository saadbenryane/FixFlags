import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/audit/FixPromptBlock', () => ({
  FixPromptBlock: ({ prompt }: { prompt: string }) => (
    <div data-testid="fix-prompt-preview">{prompt}</div>
  ),
}))

import { ReportPolishPass } from '@/components/report/ReportPolishPass'

const PROMPT = '## Mission\nFix all 2 issues.'

describe('ReportPolishPass', () => {
  it('renders loading skeleton before flags arrive', () => {
    render(<ReportPolishPass flagCount={0} prompt={null} loading />)
    expect(screen.getByLabelText('Top fixes')).toBeInTheDocument()
    expect(screen.getByText(/Ranked fix prompts appear/i)).toBeInTheDocument()
  })

  it('renders copy action for a bundled top fixes prompt', () => {
    render(<ReportPolishPass flagCount={3} prompt={PROMPT} />)
    expect(screen.getByText(/3 Flags ranked by impact/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy top fixes/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Preview prompt/i }))
    expect(screen.getByTestId('fix-prompt-preview')).toHaveTextContent('Fix all 2 issues')
  })

  it('shows locked teaser when prompts are gated', () => {
    render(<ReportPolishPass flagCount={4} prompt={null} locked signUpHref="/sign-up" />)
    expect(screen.getByText(/Create a free account/i)).toBeInTheDocument()
  })
})
