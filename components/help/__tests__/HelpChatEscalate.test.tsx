import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { SupportProvider, useSupportContext } from '@/components/live-support/SupportProvider'
import { HELP_CENTER } from '@/lib/marketing/copy'

function PanelProbe() {
  const { panelOpen } = useSupportContext()
  return <span data-testid="panel-open">{panelOpen ? 'open' : 'closed'}</span>
}

describe('HelpChatEscalate', () => {
  it('opens chat when SupportProvider is present', () => {
    render(
      <SupportProvider>
        <PanelProbe />
        <HelpChatEscalate articleTitle="Payment past due" />
      </SupportProvider>,
    )

    expect(screen.getByTestId('panel-open')).toHaveTextContent('closed')
    fireEvent.click(screen.getByRole('button', { name: HELP_CENTER.openChatCta }))
    expect(screen.getByTestId('panel-open')).toHaveTextContent('open')
  })

  it('links to contact help when SupportProvider is absent', () => {
    render(<HelpChatEscalate />)

    expect(screen.getByRole('link', { name: HELP_CENTER.openChatCta })).toHaveAttribute(
      'href',
      '/help/account/contact-us',
    )
  })
})
