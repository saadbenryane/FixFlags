'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RevealOnViewProps {
  children: ReactNode
  className?: string
  delayMs?: number
}

/** Reveal on scroll; falls back to visible within 300ms so content never stays hidden. */
export function RevealOnView({ children, className, delayMs = 0 }: RevealOnViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    let done = false
    let observer: IntersectionObserver | null = null
    const show = () => {
      if (done) return
      done = true
      setVisible(true)
      observer?.disconnect()
    }

    const fallbackId = window.setTimeout(show, 300)

    if (typeof IntersectionObserver === 'undefined') {
      show()
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) show()
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      )
      observer.observe(node)
    }

    return () => {
      window.clearTimeout(fallbackId)
      observer?.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
        className
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
