import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  RefreshCw,
  Terminal,
  Wrench,
} from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function EditorIntegrationsSection() {
  const copy = LANDING_PAGE.editorIntegrations
  const workspace = copy.workspace

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] overflow-hidden"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <header className="mx-auto max-w-[48rem] text-center">
            <p className="inline-flex items-center justify-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {copy.label}
            </p>
            <h2 className="mt-4 text-balance font-display text-[2.25rem] font-bold leading-[1.02] tracking-display text-foreground sm:text-[2.75rem] lg:text-[3rem]">
              <span className="block">{copy.headlineLines[0]}</span>
              <span className="block">
                {copy.headlineLines[1]}
                <span className="text-brand" aria-hidden>
                  .
                </span>
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-[39rem] text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              {copy.body}
            </p>
          </header>
        </RevealOnView>

        <RevealOnView>
          <div className="mx-auto mt-10 max-w-[72rem] overflow-hidden rounded-[1.25rem] border border-border/50 bg-background shadow-glass-hero">
            <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border/45 px-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <EditorMark name="Cursor" className="h-4 w-4 shrink-0 text-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {workspace.title}
                  </p>
                  <p className="truncate font-mono text-[0.625rem] text-muted-foreground">
                    {workspace.meta}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-success">
                <CircleDot className="h-3.5 w-3.5" aria-hidden />
                {workspace.status}
              </span>
            </div>

            <div className="grid lg:grid-cols-[0.7fr_1.3fr]">
              <aside className="border-b border-border/45 bg-muted/15 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {workspace.builderLabel}
                </p>
                <EditorToolMarks
                  compact
                  shortLabels
                  showLabel={false}
                  className="mt-3 [&_ul]:gap-1.5 [&_li]:rounded-[0.5rem] [&_li]:border [&_li]:border-border/45 [&_li]:bg-background [&_li]:px-2.5 [&_li]:py-1.5 [&_li]:text-[0.6875rem] [&_li]:shadow-sm"
                />

                <div className="mt-5 rounded-[0.8rem] bg-background p-4 shadow-sm ring-1 ring-border/45">
                  <p className="text-xs font-semibold text-foreground">
                    {workspace.userLabel}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">
                    {workspace.request}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2 px-1 text-[0.6875rem] text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" aria-hidden />
                  {workspace.liveProductNote}
                </div>
              </aside>

              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.55rem] bg-brand/10 text-brand">
                    <Code2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {workspace.assistantLabel}
                    </p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {workspace.assistantStatus}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {workspace.states.map((state, index) => (
                    <WorkflowState
                      key={state.id}
                      icon={
                        index === 0 ? CircleDot : index === 1 ? Wrench : RefreshCw
                      }
                      label={state.label}
                      title={state.title}
                      body={state.body}
                      success={state.id === 'recheck'}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-[0.8rem] bg-foreground px-4 py-3 text-background sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                    <div>
                      <p className="text-xs font-semibold">
                        {workspace.verifiedTitle}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-background/65">
                        {workspace.verifiedBody}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-background/75">
                    {workspace.continueLabel}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}

function WorkflowState({
  icon: Icon,
  label,
  title,
  body,
  success = false,
}: {
  icon: typeof CircleDot
  label: string
  title: string
  body: string
  success?: boolean
}) {
  return (
    <div className="relative rounded-[0.75rem] bg-muted/20 p-3.5 ring-1 ring-border/45">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Icon
            className={success ? 'h-3.5 w-3.5 text-success' : 'h-3.5 w-3.5 text-brand'}
            aria-hidden
          />
          {label}
        </span>
        {success ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : null}
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
