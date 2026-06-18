import type { ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

type ToolLogoName = (typeof LANDING_PAGE.logoCloud.logos)[number]

const LOGO_MARKS: Record<ToolLogoName, ReactNode> = {
  Cursor: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M11.98 1.4 22.2 12 11.98 22.6 1.8 12 11.98 1.4Zm0 3.55L5.25 12l6.73 7.05L18.75 12l-6.77-7.05Z" />
      <path d="M12 7.35 16.45 12 12 16.65 7.55 12 12 7.35Z" />
    </svg>
  ),
  Codex: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path
        d="M12 2.6a4.4 4.4 0 0 1 4.12 2.86 4.4 4.4 0 0 1 4.04 6.75 4.4 4.4 0 0 1-4.12 6.33 4.4 4.4 0 0 1-8.08 0 4.4 4.4 0 0 1-4.12-6.33 4.4 4.4 0 0 1 4.04-6.75A4.4 4.4 0 0 1 12 2.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.45 12 11 9.45M13 14.55 15.55 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  Lovable: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 21.15C6.47 16.22 2 12.2 2 7.9 2 4.72 4.38 2.6 7.22 2.6c1.86 0 3.6.94 4.78 2.7 1.18-1.76 2.92-2.7 4.78-2.7C19.62 2.6 22 4.72 22 7.9c0 4.3-4.47 8.32-10 13.25Z" />
    </svg>
  ),
  Bolt: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M13.25 2.5 4.5 13.35h6.15L9.9 21.5l9.6-12.1h-6.25V2.5Z" />
    </svg>
  ),
  'Claude Code': (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 12 2.1-2.1M8 12l2.1 2.1M16 12l-2.1-2.1M16 12l-2.1 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Windsurf: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path d="M3 15.5c3.4-4.8 7.15-7.2 11.25-7.2 2.25 0 4.5.72 6.75 2.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 18.5c2.25-2.45 4.78-3.68 7.6-3.68 1.9 0 3.7.45 5.4 1.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.75 5.5 13.25 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
}

export function LogoCloudSection() {
  const { label, logos, disclaimer } = LANDING_PAGE.logoCloud

  return (
    <Section spacing="compact" className="py-10 sm:py-14">
      <Container>
        <p className="text-center text-sm font-medium text-muted-foreground">
          {label}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-4 sm:gap-x-10">
          {logos.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/60 transition-[color,opacity] duration-150 ease-out hover:text-foreground hover:opacity-100"
            >
              {LOGO_MARKS[name]}
              {name}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted-foreground/60">
          {disclaimer}
        </p>
      </Container>
    </Section>
  )
}
