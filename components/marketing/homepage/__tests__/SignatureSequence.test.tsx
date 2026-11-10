import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIGNATURE_STEP_MS, SignatureSequence } from '../SignatureSequence'
import { SIGNATURE_SEQUENCE as C } from '@/lib/marketing/copy/signature-sequence'

vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))
}

const selected = () => screen.getByRole('tab', { selected: true })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('signature sequence', () => {
  it('plays Check, Flag, Fix, Verify once with the real capture, then offers Replay', () => {
    stubMotion(false)
    render(<SignatureSequence />)
    const stage = screen.getByRole('figure', { name: C.label })
    expect(within(stage).getAllByRole('tab').map(tab => tab.textContent)).toEqual(C.steps.map((step, index) => `0${index + 1}${step.tab}.${step.caption}`))
    expect(screen.getByRole('img', { name: C.browser.captureAlt })).toBeVisible()
    expect(selected()).toHaveTextContent('Check')
    expect(screen.getByRole('img', { name: C.browser.captureAlt })).toHaveAttribute('data-src', C.browser.capture)
    expect(screen.getByText(C.sampleNote)).toBeVisible()

    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS) })
    expect(selected()).toHaveTextContent('Flag')
    expect(screen.getByRole('heading', { name: C.flag.title })).toBeVisible()

    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS) })
    expect(selected()).toHaveTextContent('Fix')
    expect(screen.getByText(C.fix.tool)).toBeVisible()
    for (const line of C.fix.lines) expect(screen.getByText(line)).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS) })
    expect(selected()).toHaveTextContent('Verify')
    expect(screen.getByRole('heading', { name: C.receipt.title })).toBeVisible()
    expect(screen.getByText(C.receipt.note)).toBeVisible()
    expect(screen.getByRole('img', { name: C.browser.afterAlt })).toHaveAttribute('data-src', C.browser.after)

    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS * 3) })
    expect(selected()).toHaveTextContent('Verify')
    fireEvent.click(screen.getByRole('button', { name: C.controls.replay }))
    expect(selected()).toHaveTextContent('Check')
    expect(screen.getByRole('button', { name: C.controls.pause })).toBeVisible()
  })

  it('pauses on request and when a visitor picks a step', () => {
    stubMotion(false)
    render(<SignatureSequence />)
    fireEvent.click(screen.getByRole('button', { name: C.controls.pause }))
    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS * 2) })
    expect(selected()).toHaveTextContent('Check')
    fireEvent.click(screen.getByRole('button', { name: C.controls.play }))
    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS) })
    expect(selected()).toHaveTextContent('Flag')
    fireEvent.click(screen.getByRole('tab', { name: /Fix/ }))
    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS * 2) })
    expect(selected()).toHaveTextContent('Fix')
    expect(screen.getByRole('button', { name: C.controls.play })).toBeVisible()
  })

  it('stays still for reduced motion and moves between steps with arrow keys', () => {
    stubMotion(true)
    render(<SignatureSequence />)
    act(() => { vi.advanceTimersByTime(SIGNATURE_STEP_MS * 4) })
    expect(selected()).toHaveTextContent('Check')
    expect(screen.getByRole('button', { name: C.controls.play })).toBeVisible()
    fireEvent.keyDown(selected(), { key: 'ArrowLeft' })
    expect(selected()).toHaveTextContent('Verify')
    expect(selected()).toHaveFocus()
    fireEvent.keyDown(selected(), { key: 'ArrowRight' })
    expect(selected()).toHaveTextContent('Check')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', selected().id)
  })
})
