import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IntegrationsBlock } from '@/components/marketing/landing/IntegrationsBlock'

describe('homepage lean sections', () => {
  it('shows the compact integrations block with MCP and CLI links', () => {
    render(<IntegrationsBlock />)

    expect(screen.getByText((content) => content.includes('Works in the editor you already use'))).toBeInTheDocument()
    expect(screen.getByText('Set up MCP')).toBeInTheDocument()
    expect(screen.getByText('CLI docs')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
