import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

const LOGOS = [
  {
    name: 'Vercel',
    svg: (
      <svg viewBox="0 0 76 65" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
      </svg>
    ),
    color: 'text-foreground',
  },
  {
    name: 'Supabase',
    svg: (
      <svg viewBox="0 0 109 113" className="h-4 w-4" aria-hidden fill="none">
        <path d="M63.7 110.284c-2.75 3.45-8.37 1.5-8.44-2.9l-1.14-71.56h48.02c8.7 0 13.56 10.08 8.1 16.86L63.7 110.284z" fill="currentColor" />
        <path d="M63.7 110.284c-2.75 3.45-8.37 1.5-8.44-2.9l-1.14-71.56h48.02c8.7 0 13.56 10.08 8.1 16.86L63.7 110.284z" fill="url(#supabase-grad)" fillOpacity="0.2" />
        <path d="M45.317 2.716c2.75-3.45 8.37-1.5 8.44 2.9l.59 71.56H6.847c-8.7 0-13.56-10.08-8.1-16.86l46.57-57.6z" fill="currentColor" />
        <defs>
          <linearGradient id="supabase-grad" x1="53.974" y1="35.828" x2="94.163" y2="78.291" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    color: 'text-foreground',
  },
  {
    name: 'Linear',
    svg: (
      <svg viewBox="0 0 100 100" className="h-4 w-4" aria-hidden fill="none">
        <circle cx="50" cy="50" r="50" fill="currentColor" />
        <path d="M16.5 62.5L37.5 83.5C28.5 80.5 19.5 71.5 16.5 62.5Z" fill="white" />
        <path d="M14 53.5L46.5 86C43 85.5 39.5 84.5 36.5 83L16.5 63C15 59.5 14 56.5 14 53.5Z" fill="white" />
        <path d="M14.5 43.5L56.5 85.5C54 85.5 51.5 85 49 84.5L15.5 51C15 48.5 14.5 46 14.5 43.5Z" fill="white" />
        <path d="M16.5 34L66 83.5C63.5 84 61 84.5 58.5 85L15 41.5C15.5 39 16 36.5 16.5 34Z" fill="white" />
        <path d="M21 25.5L74.5 79C72 80 69.5 81 67 81.5L18.5 33C19.5 30.5 20 28 21 25.5Z" fill="white" />
        <path d="M27.5 18.5L81.5 72.5C79.5 74 77 75.5 74.5 77L23 25.5C24.5 23 26 20.5 27.5 18.5Z" fill="white" />
        <path d="M86 65C83 68 79.5 70.5 76.5 72.5L27.5 23.5C30 21 33 19 36 17.5L86 65Z" fill="white" />
        <path d="M86.5 53.5C85.5 57.5 84 61 82 64.5L35.5 18C39 16 42.5 14.5 46.5 13.5L86.5 53.5Z" fill="white" />
        <path d="M85.5 41C85.5 44.5 85 48 84 51L49 16C52 15 55.5 14.5 59 14.5L85.5 41Z" fill="white" />
        <path d="M82.5 30.5C83.5 33.5 84.5 36.5 85 39.5L60.5 15C63.5 15.5 66.5 16 69.5 17L82.5 30.5Z" fill="white" />
      </svg>
    ),
    color: 'text-foreground',
  },
  {
    name: 'Lovable',
    svg: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" fill="currentColor" />
      </svg>
    ),
    color: 'text-foreground',
  },
  {
    name: 'Cursor',
    svg: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M11.925 1L22 12.025 11.925 23 1.85 12.025 11.925 1zm0 3.4L4.85 12.025l7.075 7.575 7.075-7.575L11.925 4.4z" />
      </svg>
    ),
    color: 'text-foreground',
  },
  {
    name: 'bolt',
    svg: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" />
      </svg>
    ),
    color: 'text-yellow-500',
  },
]

export function LogoCloudSection() {
  return (
    <Section spacing="compact" className="py-12 sm:py-16 border-y border-border/30 bg-muted/20">
      <Container>
        <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
          TRUSTED BY BUILDERS AT
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-12">
          {LOGOS.map((logo) => (
            <li
              key={logo.name}
              className={`flex items-center gap-2 font-sans text-sm font-semibold tracking-tight ${logo.color} opacity-60 transition-opacity hover:opacity-90`}
            >
              {logo.svg}
              {logo.name}
            </li>
          ))}
          <li className="font-sans text-sm font-semibold text-muted-foreground/40">
            and more
          </li>
        </ul>
      </Container>
    </Section>
  )
}
