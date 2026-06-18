import type { ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { getEditorMark, type EditorMarkName } from '@/components/brand/EditorMarks'
import { LANDING_PAGE } from '@/lib/marketing/copy'

type ToolLogoName = (typeof LANDING_PAGE.logoCloud.logos)[number]

const LOGO_MARKS: Record<ToolLogoName, ReactNode> = Object.fromEntries(
  LANDING_PAGE.logoCloud.logos.map((name) => [name, getEditorMark(name as EditorMarkName)])
) as Record<ToolLogoName, ReactNode>

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
