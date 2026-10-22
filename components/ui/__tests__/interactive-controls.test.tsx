import { act, fireEvent, render } from '@testing-library/react'
import { createRef, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../button'
import { Input } from '../input'
import { Textarea } from '../textarea'
import { Checkbox } from '../checkbox'
import { Dialog, DialogTrigger } from '../dialog'
import { DropdownMenu, DropdownMenuTrigger } from '../dropdown-menu'
import { Select, SelectTrigger } from '../select'
import { Tabs, TabsList, TabsTrigger } from '../tabs'
import { InteractiveSelect } from '../interactive-controls'
import { FilterPill } from '../filter-pill'
import { InputGroupInput, InputGroupButton } from '../input-group'
import { Accordion, AccordionItem, AccordionTrigger } from '../accordion'
import { Tooltip, TooltipProvider, TooltipTrigger } from '../tooltip'

describe('client control readiness', () => {
  it('preserves native server fields without client callbacks', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(<><Input name="name" defaultValue="Saved name" /><Textarea name="note" defaultValue="Saved note" /></>)
    expect(container.querySelector('input')).toBeEnabled()
    expect(container.querySelector('textarea')).toBeEnabled()
    expect(container.querySelector('input')).toHaveValue('Saved name')
    expect(container.querySelector('textarea')).toHaveValue('Saved note')
  })

  it.each([
    { name: 'controlled input', element: <Input value="Saved" onChange={() => {}} />, selector: 'input' },
    { name: 'controlled textarea', element: <Textarea value="Saved" onChange={() => {}} />, selector: 'textarea' },
    { name: 'search filter', element: <FilterPill onClick={() => {}}>Help</FilterPill>, selector: 'button' },
    { name: 'grouped input', element: <InputGroupInput onChange={() => {}} />, selector: 'input' },
    { name: 'grouped command', element: <InputGroupButton onClick={() => {}}>Analyze</InputGroupButton>, selector: 'button' },
    { name: 'accordion trigger', element: <Accordion type="single"><AccordionItem value="help"><AccordionTrigger>Help</AccordionTrigger></AccordionItem></Accordion>, selector: 'button' },
    { name: 'tooltip trigger', element: <TooltipProvider><Tooltip><TooltipTrigger>More information</TooltipTrigger></Tooltip></TooltipProvider>, selector: 'button' },
    { name: 'custom select', element: <InteractiveSelect defaultValue="saved" onChange={() => {}}><option value="saved">Saved</option></InteractiveSelect>, selector: 'select' },
    { name: 'checkbox', element: <Checkbox aria-label="Remember" defaultChecked />, selector: '[role="checkbox"]' },
    { name: 'dialog trigger', element: <Dialog><DialogTrigger>Open</DialogTrigger></Dialog>, selector: 'button' },
    { name: 'menu trigger with a native child', element: <DropdownMenu><DropdownMenuTrigger asChild><button>Open</button></DropdownMenuTrigger></DropdownMenu>, selector: 'button' },
    { name: 'select trigger', element: <Select><SelectTrigger>Choose</SelectTrigger></Select>, selector: '[role="combobox"]' },
    { name: 'tab trigger', element: <Tabs defaultValue="saved"><TabsList><TabsTrigger value="saved">Saved</TabsTrigger></TabsList></Tabs>, selector: '[role="tab"]' },
  ])('keeps the server-rendered $name pending until its handlers are ready', ({ element, selector }) => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    const control = container.querySelector(selector)
    expect(control).toBeDisabled()
    expect(control).toHaveAttribute('aria-busy', 'true')
  })

  it('captures edits in application state after hydration instead of leaving an unsaved DOM-only value', async () => {
    const saved = vi.fn(), ref = createRef<HTMLInputElement>()
    function Profile() {
      const [name, setName] = useState('Saved name')
      return <form onSubmit={event => { event.preventDefault(); saved(name) }}>
        <Input ref={ref} aria-label="Name" value={name} onChange={event => setName(event.target.value)} />
        <Button type="submit" disabled={name === 'Saved name'}>Save</Button>
      </form>
    }
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Profile />)
    document.body.append(container)
    const input = container.querySelector('input')!, submit = container.querySelector('button')!
    expect(input).toBeDisabled()
    expect(submit).toBeDisabled()
    let root: Root | undefined
    try {
      await act(async () => { root = hydrateRoot(container, <Profile />) })
      expect(input).toBeEnabled()
      expect(ref.current).toBe(input)
      await act(async () => { fireEvent.change(input, { target: { value: 'Unsaved edit' } }) })
      expect(submit).toBeEnabled()
      fireEvent.click(submit)
      expect(saved).toHaveBeenCalledExactlyOnceWith('Unsaved edit')
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })

  it('keeps a separately disabled control unavailable after client mounting', () => {
    const view = render(<><Input disabled onChange={() => {}} /><Textarea disabled onChange={() => {}} /><Checkbox disabled /></>)
    for (const control of view.container.querySelectorAll('input,textarea,[role="checkbox"]')) expect(control).toBeDisabled()
  })
})
