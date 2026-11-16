import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FixPromptCard } from '../FixPromptCard'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { AI_CONNECTION_PATH } from '@/lib/marketing/copy/ai-connection'

describe('FixPromptCard', () => {
  it('offers the coding-agent handoff beside the copy action when a connection path is given', () => {
    render(<FixPromptCard prompt="Fix the cart" onCopy={vi.fn()} copyLabel="Copy fix instructions" copiedLabel="Copied" agentHref={AI_CONNECTION_PATH} />)
    expect(screen.getByRole('button', { name: 'Copy fix instructions' })).toBeEnabled()
    expect(screen.getByText(C.agentHandoff)).toBeVisible()
    expect(screen.getByRole('link', { name: C.agentHandoffAction })).toHaveAttribute('href', AI_CONNECTION_PATH)
  })

  it('keeps the sample card free of the agent handoff', () => {
    render(<FixPromptCard prompt="Fix the cart" onCopy={vi.fn()} copyLabel="Copy fix instructions" copiedLabel="Copied" />)
    expect(screen.queryByRole('link', { name: C.agentHandoffAction })).toBeNull()
  })
})
