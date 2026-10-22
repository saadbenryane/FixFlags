'use client'

import { useEffect, type RefObject } from 'react'

export const BOTTOM_NOTICE_EVENT = 'fixflags:bottom-notice-change'
const notices = new Map<HTMLElement, number>()

function updateInsets() {
  let offset = 0
  const visible = [...notices.entries()].filter(([element]) => {
    if (element.getBoundingClientRect().height > 0) return true
    element.style.removeProperty('--bottom-notice-offset')
    return false
  }).sort((a, b) => a[1] - b[1])
  for (const [element] of visible) {
    element.style.setProperty('--bottom-notice-offset', `${offset}px`)
    offset += element.getBoundingClientRect().height + 12
  }
  const inset = Math.max(0, ...visible.map(([element]) => {
    const box = element.getBoundingClientRect()
    return box.height > 0 ? window.innerHeight - box.top : 0
  }))
  document.documentElement.style.setProperty('--bottom-notice-inset', `${inset}px`)
  window.dispatchEvent(new Event(BOTTOM_NOTICE_EVENT))
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement) || focused === document.body || focused === document.documentElement ||
      [...notices.keys()].some(element => element.contains(focused))) return
  const bounds = focused.getBoundingClientRect()
  if ([...notices.keys()].some(element => {
    const notice = element.getBoundingClientRect()
    if (!(bounds.bottom > notice.top && bounds.top < notice.bottom && bounds.right > notice.left && bounds.left < notice.right)) return false
    const point = document.elementFromPoint((Math.max(bounds.left, notice.left) + Math.min(bounds.right, notice.right)) / 2,
      (Math.max(bounds.top, notice.top) + Math.min(bounds.bottom, notice.bottom)) / 2)
    return Boolean(point && element.contains(point))
  })) focused.scrollIntoView({ block: 'center', inline: 'nearest' })
}

/** Fixed notices share space and keep focused page controls reachable. */
export function useFixedBottomNotice(ref: RefObject<HTMLElement | null>, active: boolean, priority: number) {
  useEffect(() => {
    const element = ref.current
    if (!active || !element) return
    notices.set(element, priority)
    let previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body &&
      !element.contains(document.activeElement) ? document.activeElement : null
    let frame = 0
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updateInsets) }
    const onFocus = () => {
      const focused = document.activeElement
      if (focused instanceof HTMLElement && focused !== document.body && !element.contains(focused)) previousFocus = focused
      queue()
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null
    observer?.observe(element)
    observer?.observe(document.body)
    window.addEventListener('resize', queue)
    document.addEventListener('focusin', onFocus)
    updateInsets()
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', queue)
      document.removeEventListener('focusin', onFocus)
      notices.delete(element)
      element.style.removeProperty('--bottom-notice-offset')
      updateInsets()
      if (previousFocus?.isConnected && (document.activeElement === document.body || element.contains(document.activeElement)))
        previousFocus.focus({ preventScroll: true })
    }
  }, [active, priority, ref])
}
