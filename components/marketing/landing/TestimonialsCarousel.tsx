'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type TestimonialQuote = (typeof LANDING_PAGE.testimonials.quotes)[number]

function TestimonialCard({ quote }: { quote: TestimonialQuote }) {
  return (
    <figure
      data-carousel-item
      className={cn(
        'flex h-full w-[min(100%,20rem)] shrink-0 snap-start flex-col rounded-card glass-surface-elevated p-6 shadow-card sm:w-[22rem] sm:p-7',
        'motion-safe:transition-[box-shadow,transform] motion-safe:duration-300 motion-safe:ease-out',
        'hover:shadow-card-hover motion-reduce:transition-none'
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {quote.context}
      </span>

      <blockquote className="relative mt-4 flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-0.5 -top-3 text-4xl font-bold leading-none text-muted-foreground/12 select-none"
        >
          &ldquo;
        </span>
        <p className="relative text-[15px] leading-relaxed text-foreground/85 text-pretty sm:text-base">
          {quote.quote}
        </p>
      </blockquote>

      <figcaption className="mt-5 border-t border-border/40 pt-4">
        <cite className="not-italic text-sm font-medium text-foreground">{quote.role}</cite>
      </figcaption>
    </figure>
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

    node.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  return (
    <div className="space-y-4">
      <div className="relative -mx-4 sm:-mx-6">
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/20 to-transparent transition-opacity duration-200 sm:w-12',
            canScrollPrev ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-muted/20 to-transparent transition-opacity duration-200 sm:w-12',
            canScrollNext ? 'opacity-100' : 'opacity-0'
          )}
        />

        <div
          ref={scrollRef}
          role="region"
          aria-label="Example feedback quotes"
          tabIndex={0} /* eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- needed for keyboard scrolling of overflow-x */
          className={cn(
            'flex gap-5 overflow-x-auto scroll-smooth px-4 py-1 sm:px-6',
            'snap-x snap-mandatory',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
        >
          {quotes.map((quote) => (
            <TestimonialCard key={quote.id} quote={quote} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 bg-background/70"
          aria-label="Show previous feedback"
          disabled={!canScrollPrev}
          onClick={() => scrollByPage('prev')}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 bg-background/70"
          aria-label="Show next feedback"
          disabled={!canScrollNext}
          onClick={() => scrollByPage('next')}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}
