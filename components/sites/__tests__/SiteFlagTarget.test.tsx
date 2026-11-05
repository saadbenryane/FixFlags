import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SiteFlagTarget } from '../SiteFlagTarget'
import { SiteWorkspaceLocationProvider } from '../SiteWorkspaceLocation'

const href = '/sites/site-1/flags/incident-1'

it('renders the current workspace into the native destination before hydration', () => {
  const markup = renderToString(<SiteWorkspaceLocationProvider value={{ siteId: 'site-1', viewMode: 'pages', selectedCard: null }}>
    <SiteFlagTarget href={href} onOpen={vi.fn()}>Pricing is unavailable</SiteFlagTarget>
  </SiteWorkspaceLocationProvider>)
  expect(markup).toContain(`href="${href}?view=pages"`)
})

it('updates destinations with the navigation owner while preserving in-place activation', () => {
  const open = vi.fn()
  const view = (viewMode: 'pages' | 'timeline') => <SiteWorkspaceLocationProvider value={{ siteId: 'site-1', viewMode, selectedCard: null }}>
    <SiteFlagTarget href={href} onOpen={open}>Pricing is unavailable</SiteFlagTarget>
  </SiteWorkspaceLocationProvider>
  const rendered = render(view('pages'))
  expect(screen.getByRole('link')).toHaveAttribute('href', `${href}?view=pages`)
  rendered.rerender(view('timeline'))
  const target = screen.getByRole('link')
  expect(target).toHaveAttribute('href', `${href}?view=timeline`)
  fireEvent.click(target)
  expect(open).toHaveBeenCalledExactlyOnceWith(target)
})

it('opens ordinary clicks in place and retains the real anchor for focus restoration', () => {
  const open = vi.fn()
  render(<SiteFlagTarget href={href} onOpen={open}>Pricing is unavailable</SiteFlagTarget>)
  const target = screen.getByRole('link', { name: 'Pricing is unavailable' })
  expect(target).toHaveAttribute('href', href)
  expect(fireEvent.click(target)).toBe(false)
  expect(open).toHaveBeenCalledExactlyOnceWith(target)
})

it.each([
  { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 },
])('preserves native navigation for a modified click: %j', modifiers => {
  const open = vi.fn(), native = vi.fn()
  render(<SiteFlagTarget href={href} onOpen={open}>Pricing is unavailable</SiteFlagTarget>)
  document.addEventListener('click', event => { native(!event.defaultPrevented); event.preventDefault() }, { once: true })
  fireEvent.click(screen.getByRole('link'), modifiers)
  expect(open).not.toHaveBeenCalled()
  expect(native).toHaveBeenCalledExactlyOnceWith(true)
})

it('honors a click already cancelled by an enclosing control', () => {
  const open = vi.fn()
  render(<SiteFlagTarget href={href} onOpen={open}>Pricing is unavailable</SiteFlagTarget>)
  document.addEventListener('click', event => event.preventDefault(), { capture: true, once: true })
  fireEvent.click(screen.getByRole('link'))
  expect(open).not.toHaveBeenCalled()
})

it('renders a usable native destination before hydration', () => {
  const markup = renderToString(<SiteFlagTarget href={href} onOpen={vi.fn()}>Pricing is unavailable</SiteFlagTarget>)
  expect(markup).toContain(`href="${href}"`)
  expect(markup).not.toContain('disabled')
  expect(markup).not.toContain('aria-busy')
})

it.each([undefined, '#product'])('keeps a local disclosure with no Flag destination as a button: %s', href => {
  const open = vi.fn()
  render(<SiteFlagTarget href={href} onOpen={open}>Sample finding</SiteFlagTarget>)
  const target = screen.getByRole('button', { name: 'Sample finding' })
  expect(target).toHaveAttribute('type', 'button')
  fireEvent.click(target)
  expect(open).toHaveBeenCalledExactlyOnceWith(target)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('keeps a destination without an in-place opener as an ordinary link', () => {
  const native = vi.fn()
  render(<SiteFlagTarget href={href}>Pricing is unavailable</SiteFlagTarget>)
  document.addEventListener('click', event => { native(!event.defaultPrevented); event.preventDefault() }, { once: true })
  fireEvent.click(screen.getByRole('link'))
  expect(native).toHaveBeenCalledExactlyOnceWith(true)
})
