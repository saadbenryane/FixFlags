/**
 * Shared verdict callout for the sticky wayfinding band. Rendered above the
 * section toolbar on completed and progressive report frames.
 */
export function ReportVerdictBlockquote({ verdict }: { verdict: string }) {
  return (
    <blockquote className="border-l-2 border-brand pl-4 font-sans text-sm font-medium leading-relaxed text-foreground text-pretty sm:text-base">
      {verdict}
    </blockquote>
  )
}
