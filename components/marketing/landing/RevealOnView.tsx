'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RevealOnViewProps {
  children: ReactNode
  className?: string
  delayMs?: number
}

/**
 * Progressive reveal: server-rendered content is visible by default. Once the
 * browser supports observation, only below-fold content waits to animate.
 */
export function RevealOnView({ children, className, delayMs = 0 }: RevealOnViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (
      !node ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return

    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.92) return

    setVisible(false)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )
    observer.observe(node)

    return () => {
      observer.disconnect()
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
