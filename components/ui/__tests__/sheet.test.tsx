import { createRef } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../sheet'

it.each([false, true])('keeps native dismissal and trigger focus with a separate header: %s', async separateHeader => {
  const heading = <SheetHeader><SheetTitle>Check history</SheetTitle><SheetDescription>Previous website checks.</SheetDescription></SheetHeader>
  render(<Sheet><SheetTrigger>Open history</SheetTrigger>
    <SheetContent header={separateHeader ? heading : undefined}>
      {!separateHeader ? heading : null}
      <button>Inspect previous check</button>
    </SheetContent>
  </Sheet>)
  const trigger = screen.getByRole('button', { name: 'Open history' })
  trigger.focus(); fireEvent.click(trigger)
  const sheet = screen.getByRole('dialog', { name: 'Check history' })
  expect(sheet).toHaveAccessibleDescription('Previous website checks.')
  const inspect = within(sheet).getByRole('button', { name: 'Inspect previous check' })
  await waitFor(() => expect(inspect).toHaveFocus())
  const close = within(sheet).getAllByRole('button', { name: 'Close' })
  expect(close).toHaveLength(1)
  fireEvent.click(close[0])
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('retains the public ref and dismissal guards with a separate header', () => {
  const ref = createRef<HTMLDivElement>(), changed = vi.fn()
  render(<Sheet open onOpenChange={changed}>
    <SheetContent ref={ref} header={<SheetTitle>Choose a plan</SheetTitle>} aria-describedby={undefined}
      onEscapeKeyDown={event => event.preventDefault()}>
      <button>Continue free</button>
    </SheetContent>
  </Sheet>)
  const sheet = screen.getByRole('dialog', { name: 'Choose a plan' })
  expect(ref.current).toBe(sheet)
  fireEvent.keyDown(sheet, { key: 'Escape' })
  expect(changed).not.toHaveBeenCalled()
  expect(sheet).toBeVisible()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(changed).toHaveBeenCalledExactlyOnceWith(false)
})
