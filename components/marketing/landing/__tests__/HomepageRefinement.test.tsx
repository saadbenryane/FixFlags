import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { IntegrationsBlock } from '@/components/marketing/landing/IntegrationsBlock'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'

beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('homepage lean sections', () => {
  it('shows the compact integrations block with MCP and CLI links', () => {
    render(<IntegrationsBlock />)

    expect(screen.getByText((content) => content.includes('Works in the editor you already use'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up MCP' })).toHaveAttribute(
      'href',
      '/docs/integrations#quick-start'
    )
    expect(screen.getByRole('link', { name: 'CLI docs' })).toHaveAttribute('href', '/docs/cli')
    expect(screen.getAllByRole('link', { name: /integration guide/i })).toHaveLength(8)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the sample from the shared report model instead of a flattened screenshot', () => {
    render(<SampleReportSection />)

    expect(
      screen.getByRole('region', {
        name: 'Release score, unresolved Flags, score history, and rubric coverage',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('5 completed product reviews')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View all 7 Flags' })).toBeInTheDocument()
    expect(screen.getByText('199+')).toBeInTheDocument()
    expect(
      screen.queryByAltText(/Generated FixFlags sample Finish Plan/i)
    ).not.toBeInTheDocument()
  })
})
