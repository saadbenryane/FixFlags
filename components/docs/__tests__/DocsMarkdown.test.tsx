import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DocsMarkdown } from '../DocsMarkdown'

describe('documentation section continuity', () => {
  it('keeps a previous section bookmark alongside the current heading without repeating its text', () => {
    render(<DocsMarkdown headings={[{ id: 'connections', title: 'Connections', aliases: ['shopify-connection'] }]}>
      {'## Connections\n\nGitHub account authorization is available.'}
    </DocsMarkdown>)
    expect(screen.getByRole('heading', { name: 'Connections' })).toHaveAttribute('id', 'connections')
    expect(document.getElementById('shopify-connection')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByText('Connections')).toHaveLength(1)
  })
})
