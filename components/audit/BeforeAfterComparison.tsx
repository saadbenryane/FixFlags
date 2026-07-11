'use client'

import { useState, useRef, useCallback } from 'react'
import { viewportAspectStyle } from '@/lib/audit/viewports'

interface Props {
  beforeUrl: string
  afterUrl: string
  device?: 'desktop' | 'mobile'
}

export function BeforeAfterComparison({ beforeUrl, afterUrl, device = 'desktop' }: Props) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPosition((x / rect.width) * 100)
  }, [])

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={position}
      tabIndex={0}
      className="relative w-full overflow-hidden rounded-card bg-muted/30 shadow-card select-none cursor-col-resize"
      style={viewportAspectStyle(device)}
      onMouseDown={(e) => {
        dragging.current = true
        updatePosition(e.clientX)
      }}
      onMouseMove={(e) => {
        if (dragging.current) updatePosition(e.clientX)
      }}
      onMouseUp={() => {
        dragging.current = false
      }}
      onMouseLeave={() => {
        dragging.current = false
      }}
      onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
      onTouchMove={(e) => updatePosition(e.touches[0].clientX)}
      onKeyDown={(e) => {
        const step = 1
        if (e.key === 'ArrowRight') {
          setPosition((p) => Math.min(100, p + step))
        } else if (e.key === 'ArrowLeft') {
          setPosition((p) => Math.max(0, p - step))
        }
      }}
    >
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="After" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute bottom-2 right-2 rounded-nested-sm bg-terminal/80 px-2 py-0.5 text-xs text-terminal-foreground">
          After
        </div>
      </div>

      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Before"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <div
          className="absolute bottom-2 left-2 rounded-nested-sm bg-terminal/80 px-2 py-0.5 text-xs text-terminal-foreground"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          Before
        </div>
      </div>

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-background shadow-card pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-card">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M4 2L1 6L4 10M8 2L11 6L8 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
