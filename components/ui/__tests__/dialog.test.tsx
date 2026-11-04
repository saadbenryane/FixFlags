import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../dialog'

function Example({ titleFocus = false, onOpenAutoFocus }: { titleFocus?: boolean; onOpenAutoFocus?: (event: Event) => void }) {
  return <Dialog><DialogTrigger>Inspect evidence</DialogTrigger><DialogContent header={<DialogTitle>Recorded page evidence</DialogTitle>} initialFocus={titleFocus ? 'title' : 'automatic'} onOpenAutoFocus={onOpenAutoFocus}>
    <DialogDescription>Observed behavior and its original scope.</DialogDescription><input aria-label="Change summary" />
  </DialogContent></Dialog>
}

describe('shared dialog focus contract', () => {
  it.each(['disabled', 'removed'] as const)('returns to the page heading when a confirmed action leaves its opener %s', async mode => {
    function Verification() {
      const [open, setOpen] = useState(false)
      const [started, setStarted] = useState(false)
      return <main tabIndex={-1}><h1 tabIndex={-1}>Recorded Flag</h1>
        {mode === 'removed' && started ? null : <button disabled={started} onClick={() => setOpen(true)}>Verify repair</button>}
        <Dialog open={open} onOpenChange={setOpen}><DialogContent header={<DialogTitle>Check this repair</DialogTitle>}>
          <DialogDescription>Independent verification of the original scope.</DialogDescription>
          <button onClick={() => { setStarted(true); setOpen(false) }}>Start verification</button>
        </DialogContent></Dialog>
      </main>
    }
    render(<Verification />)
    const opener = screen.getByRole('button', { name: 'Verify repair' })
    opener.focus(); fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Recorded Flag' })).toHaveFocus())
  })

  it('returns to the parent detail heading when a nested verification disables its opener', async () => {
    function Verification() {
      const [open, setOpen] = useState(false)
      const [started, setStarted] = useState(false)
      return <Dialog defaultOpen><DialogContent header={<DialogTitle>Original Flag evidence</DialogTitle>} initialFocus="title">
        <DialogDescription>The recorded problem and its evidence.</DialogDescription>
        <button disabled={started} onClick={() => setOpen(true)}>Verify repair</button>
        <Dialog open={open} onOpenChange={setOpen}><DialogContent header={<DialogTitle>Check this repair</DialogTitle>}>
          <DialogDescription>Independent verification of the original scope.</DialogDescription>
          <button onClick={() => { setStarted(true); setOpen(false) }}>Start verification</button>
        </DialogContent></Dialog>
      </DialogContent></Dialog>
    }
    render(<Verification />)
    const opener = screen.getByRole('button', { name: 'Verify repair' })
    opener.focus(); fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: 'Start verification' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('Original Flag evidence'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Original Flag evidence' })).toHaveFocus())
  })

  it('does not restore the old page context after a confirmed action navigates elsewhere', async () => {
    const original = window.location.href
    const closed = vi.fn()
    function Verification() {
      const [open, setOpen] = useState(false)
      const [started, setStarted] = useState(false)
      return <main tabIndex={-1}><h1 tabIndex={-1}>{started ? 'Another workspace' : 'Recorded Flag'}</h1>
        <button disabled={started} onClick={() => setOpen(true)}>Verify repair</button>
        <Dialog open={open} onOpenChange={setOpen}><DialogContent header={<DialogTitle>Check this repair</DialogTitle>} onCloseAutoFocus={closed}>
          <DialogDescription>Independent verification of the original scope.</DialogDescription>
          <button onClick={() => { window.history.replaceState(null, '', '/another-workspace'); setStarted(true); setOpen(false) }}>Start verification</button>
        </DialogContent></Dialog>
      </main>
    }
    try {
      render(<Verification />)
      const opener = screen.getByRole('button', { name: 'Verify repair' })
      opener.focus(); fireEvent.click(opener)
      fireEvent.click(screen.getByRole('button', { name: 'Start verification' }))
      await waitFor(() => expect(closed).toHaveBeenCalledOnce())
      expect(screen.getByRole('heading', { name: 'Another workspace' })).not.toHaveFocus()
    } finally { window.history.replaceState(null, '', original) }
  })

  it('returns a controlled repair dialog to its opener when there is no Radix Trigger', async () => {
    function ControlledRepair() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Check published repair</button><Dialog open={open} onOpenChange={setOpen}>
        <DialogContent header={<DialogTitle>Verify the original scope</DialogTitle>}>
          <DialogDescription>Record the publication before independent verification.</DialogDescription><input aria-label="Publication" />
        </DialogContent>
      </Dialog></>
    }
    render(<ControlledRepair />)
    const opener = screen.getByRole('button', { name: 'Check published repair' })
    opener.focus()
    fireEvent.click(opener)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Publication' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('starts informational depth at its heading, keeps its accessible description, and restores its trigger', async () => {
    render(<Example titleFocus />)
    const trigger = screen.getByRole('button', { name: 'Inspect evidence' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Recorded page evidence' })
    expect(dialog).toHaveAccessibleDescription('Observed behavior and its original scope.')
    await waitFor(() => expect(within(dialog).getByRole('heading')).toHaveFocus())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('preserves first-control autofocus for an action form', async () => {
    render(<Example />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect evidence' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Change summary' })).toHaveFocus())
  })
  it('honors a caller that owns initial focus instead of overriding it with the heading', async () => {
    const custom = vi.fn((event: Event) => { event.preventDefault(); screen.getByRole('textbox').focus() })
    render(<Example titleFocus onOpenAutoFocus={custom} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect evidence' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
    expect(custom).toHaveBeenCalledOnce()
  })
  it('preserves the public content ref and close-autofocus override', async () => {
    const ref = createRef<HTMLDivElement>()
    const close = vi.fn((event: Event) => event.preventDefault())
    render(<Dialog defaultOpen><DialogContent ref={ref} header={<DialogTitle>Evidence</DialogTitle>} onCloseAutoFocus={close}>
      <DialogDescription>Original observations.</DialogDescription>
    </DialogContent></Dialog>)
    expect(ref.current).toBe(screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(close.mock.calls[0][0].defaultPrevented).toBe(true)
  })
})
