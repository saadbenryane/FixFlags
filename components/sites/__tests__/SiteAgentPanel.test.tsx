import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteAgentPanel } from '@/components/sites/SiteAgentPanel'

describe('SiteAgentPanel', () => {
  it('stays in the page header on a phone and docks to the corner on a wide screen', () => {
    render(<SiteAgentPanel siteId="site_1" />)
    const button = screen.getByRole('button', { name: 'Open FixFlags Agent' })
    expect(button.className).toContain('lg:fixed')
    expect(button.className).toContain('lg:bottom-6')
    expect(button.className).not.toMatch(/(^|\s)fixed(\s|$)/)
    expect(button.className).not.toContain('bottom-20')
  })
})
