import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { createRef } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

describe('Button', () => {
  it('keeps native server forms and links available without a JavaScript handler', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(<><Button type="submit">Submit form</Button><Button asChild><Link href="/docs">Docs</Link></Button></>)
    expect(container.querySelector('button')).not.toBeDisabled()
    expect(container.querySelector('a')).toHaveAttribute('href', '/docs')
    expect(container.querySelector('a')).not.toHaveAttribute('aria-disabled')
  })

  it.each(['onClick', 'onPointerDown'] as const)('keeps a server-rendered %s command pending until it can respond', name => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Button {...{ [name]: vi.fn() }}>Open panel</Button>)
    expect(container.querySelector('button')).toBeDisabled()
    expect(container.querySelector('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('enables a command after hydration with its original handler and ref', async () => {
    const clicked = vi.fn(), ref = createRef<HTMLButtonElement>()
    const element = <Button ref={ref} onClick={clicked}>Open panel</Button>
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    document.body.append(container)
    const button = container.querySelector('button')!
    button.click()
    expect(clicked).not.toHaveBeenCalled()
    let root: Root | undefined
    try {
      await act(async () => { root = hydrateRoot(container, element) })
      expect(button).toBeEnabled()
      expect(button).not.toHaveAttribute('aria-busy')
      expect(ref.current).toBe(button)
      button.click()
      expect(clicked).toHaveBeenCalledOnce()
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })

  it('slots styles onto a single child element', () => {
    render(
      <Button asChild>
        <a href="/dashboard">Dashboard</a>
      </Button>
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  it('keeps the slotted element while showing its loading state', () => {
    render(
      <Button asChild loading loadingLabel="Opening dashboard">
        <a href="/dashboard">Dashboard</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Opening dashboard' })
    expect(link).toHaveAttribute('href', '/dashboard')
    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')
    expect(link.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
  })

  it('disables a loading button and exposes its busy state', () => {
    render(
      <Button loading loadingLabel="Saving">
        Save
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Saving' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
