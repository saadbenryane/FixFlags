import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignatureSequence, STORY_LINE } from '../SignatureSequence'
import { SIGNATURE_SEQUENCE as C } from '@/lib/marketing/copy/signature-sequence'

vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <span role="img" aria-label={alt} data-src={src} /> }))

let frames: FrameRequestCallback[] = []
let scrolled = 0
let stageBottom = 0
/** Where each step heading sits on the page before scrolling. */
const HEADING_TOPS = [300, 1100, 1900, 2700]

function stubLayout(narrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: narrow && query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const index = [...document.querySelectorAll('[data-story] h3')].indexOf(this)
    const top = index >= 0 ? HEADING_TOPS[index] - scrolled : 0
    const bottom = index >= 0 ? top + 80 : stageBottom
    return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} } as DOMRect
  })
}

function scrollTo(y: number) {
  scrolled = y
  fireEvent.scroll(window)
  act(() => { const pending = frames; frames = []; pending.forEach(callback => callback(0)) })
}

const stage = () => screen.getByRole('figure', { name: C.label })
const current = () => screen.getAllByRole('listitem').find(item => item.getAttribute('aria-current') === 'step')

beforeEach(() => { frames = []; scrolled = 0; stageBottom = 0 })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('homepage story', () => {
  it('tells Check, Flag, Fix, Verify over the same demo store, with every layer in the reading order', () => {
    stubLayout(false)
    render(<SignatureSequence />)
    const story = screen.getByRole('region', { name: C.title })
    expect(within(story).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(C.steps.map(step => `${step.tab}.`))
    for (const step of C.steps) {
      const caption = within(story).getByText(step.caption)
      expect(caption).toBeVisible()
      for (const point of step.points) expect(within(caption.closest('li')!).getByText(point)).toBeVisible()
    }
    const tools = within(story).getByRole('list', { name: C.toolsLabel })
    expect(within(tools).getAllByRole('listitem').map(item => item.textContent)).toEqual([...C.tools])
    expect(within(stage()).getByRole('img', { name: C.phone.beforeAlt })).toHaveAttribute('data-src', C.phone.before)
    expect(within(stage()).getByRole('img', { name: C.phone.afterAlt })).toHaveAttribute('data-src', C.phone.after)
    expect(within(stage()).getByText(C.check.title)).toBeInTheDocument()
    expect(within(stage()).getByText(C.flag.title)).toBeInTheDocument()
    for (const line of C.fix.lines) expect(within(stage()).getByText(line)).toBeInTheDocument()
    expect(within(stage()).getByText(C.receipt.title)).toBeInTheDocument()
    expect(within(story).getByRole('link', { name: C.verifyAction.label })).toHaveAttribute('href', C.verifyAction.href)
    expect(within(story).queryByRole('button')).not.toBeInTheDocument()
  })

  it('moves to the step whose words the visitor has scrolled to, in both directions', () => {
    stubLayout(false)
    render(<SignatureSequence />)
    expect(stage()).toHaveAttribute('data-step', 'check')
    expect(current()).toHaveTextContent(C.steps[0].caption)

    const line = window.innerHeight * STORY_LINE.wide
    scrollTo(HEADING_TOPS[1] - line + 1)
    expect(stage()).toHaveAttribute('data-step', 'flag')
    scrollTo(HEADING_TOPS[2] - line + 1)
    expect(stage()).toHaveAttribute('data-step', 'fix')
    scrollTo(HEADING_TOPS[3] - line + 1)
    expect(stage()).toHaveAttribute('data-step', 'verify')
    expect(current()).toHaveTextContent(C.steps[3].caption)

    scrollTo(0)
    expect(stage()).toHaveAttribute('data-step', 'check')
  })

  it('measures from the space below the pinned phone on narrow screens', () => {
    stageBottom = 500
    stubLayout(true)
    render(<SignatureSequence />)
    const line = stageBottom + (window.innerHeight - stageBottom) * STORY_LINE.narrow
    scrollTo(HEADING_TOPS[1] - line - 1)
    expect(stage()).toHaveAttribute('data-step', 'check')
    scrollTo(HEADING_TOPS[1] - line + 1)
    expect(stage()).toHaveAttribute('data-step', 'flag')
  })
})
