import type { Route } from 'next'
import Link from 'next/link'
import { TOOL_EDUCATION } from '@/lib/marketing/copy/tool-education'

export function ToolEducation({ tool }: { tool: keyof typeof TOOL_EDUCATION }) {
  const copy = TOOL_EDUCATION[tool]
  return <section className="mt-16 space-y-8" aria-labelledby={`${tool}-education`}>
    <h2 id={`${tool}-education`} className="font-display text-2xl font-semibold tracking-display">{copy.title}</h2>
    <div className="space-y-7">{copy.sections.map(section => <section key={section.title} className="space-y-2">
      <h3 className="text-base font-semibold">{section.title}</h3>
      <p className="text-sm leading-7 text-muted-foreground">{section.body}</p>
    </section>)}</div>
    <nav aria-label="Related website checks" className="flex flex-wrap gap-x-6 gap-y-3">
      {copy.links.map(link => <Link key={link.href} href={link.href as Route} className="inline-flex min-h-11 items-center text-sm text-link underline underline-offset-4">{link.label}</Link>)}
    </nav>
  </section>
}
