'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, type UIEvent } from 'react'

/** Follow new content and viewport changes until the reader scrolls away. */
export function useTranscriptScroll(content: unknown, { busy = false, ready = false, enabled = true, threshold = 60, scope }: {
  busy?: boolean; ready?: boolean; enabled?: boolean; threshold?: number; scope?: string | null;
} = {}) {
  const transcriptRef = useRef<HTMLDivElement>(null)
  const reading = useMemo(() => ({ scope, following: true }), [scope])
  const scroll = useCallback(() => {
    const node = transcriptRef.current
    if (!enabled || !reading.following || !node) return
    if (typeof node.scrollTo === 'function') node.scrollTo({ top: node.scrollHeight, behavior: 'instant' })
    else node.scrollTop = node.scrollHeight
  }, [enabled, reading])
  useLayoutEffect(() => { scroll() }, [content, busy, ready, scroll])
  useLayoutEffect(() => {
    const node = transcriptRef.current
    if (!enabled || !node) return
    let active = true
    const observer = new ResizeObserver(() => { if (active) scroll() })
    observer.observe(node)
    return () => { active = false; observer.disconnect() }
  }, [enabled, scroll])
  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    reading.following = node.scrollHeight - node.scrollTop - node.clientHeight < threshold
  }, [threshold, reading])
  const followLatest = useCallback(() => { reading.following = true }, [reading])
  return { transcriptRef, onScroll, followLatest }
}
