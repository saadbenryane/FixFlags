'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type TestimonialQuote = (typeof LANDING_PAGE.testimonials.quotes)[number]

function ExampleFindingCard({ quote }: { quote: TestimonialQuote }) {
  return (
    <article
      data-carousel-item
      className="flex h-full w-[min(100%,20rem)] shrink-0 snap-start flex-col rounded-card glass-surface-elevated p-6 shadow-card sm:w-[22rem] sm:p-7"
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {LANDING_PAGE.testimonials.cardLabel} · {quote.context}
      </span>

      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground/85 text-pretty sm:text-base">
        {quote.quote}
      </p>

      <p className="mt-5 border-t border-border/40 pt-4 text-sm font-medium text-foreground">
        {quote.role}
      </p>
    </article>
  )
}

export function TestimonialsCarousel({ quotes }: { quotes: readonly TestimonialQuote[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current
    if (!node) return

    const maxScroll = node.scrollWidth - node.clientWidth
    setCanScrollPrev(node.scrollLeft > 4)
    setCanScrollNext(maxScroll > 4 && node.scrollLeft < maxScroll - 4)
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    updateScrollState()

    node.addEventListener('scroll', updateScrollState, { passive: true })

    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(node)

    return () => {
      node.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [updateScrollState, quotes.length])

  const scrollByPage = useCallback((direction: 'prev' | 'next') => {
    const node = scrollRef.current
    if (!node) return

    const firstCard = node.querySelector<HTMLElement>('[data-carousel-item]')
    const cardWidth = firstCard?.offsetWidth ?? node.clientWidth * 0.82
    const gap = 20
    const delta = direction === 'next' ? cardWidth + gap : -(cardWidth + gap)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollBy({ left: delta, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [])

  return (
    <div className="space-y-4">
      <div className="relative w-[calc(50vw+50%)] max-w-none">
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/20 to-transparent transition-opacity duration-200 sm:w-12',
            canScrollPrev ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          ref={scrollRef}
          role="region"
          aria-label="Example findings"
          tabIndex={0} /* eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- needed for keyboard scrolling of overflow-x */
          className={cn(
            'flex gap-5 overflow-x-auto scroll-smooth py-1 pr-5 sm:pr-6 lg:pr-8',
            'snap-x snap-mandatory',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
        >
          {quotes.map((quote) => (
            <ExampleFindingCard key={quote.id} quote={quote} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 min-h-11 min-w-11 shrink-0 bg-background/70"
          aria-label="Show previous finding"
          disabled={!canScrollPrev}
          onClick={() => scrollByPage('prev')}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 min-h-11 min-w-11 shrink-0 bg-background/70"
          aria-label="Show next finding"
          disabled={!canScrollNext}
          onClick={() => scrollByPage('next')}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}
