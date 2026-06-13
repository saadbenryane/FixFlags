interface Props {
  label: string
  children: string
}

export function TerminalBlock({ label, children }: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-terminal-border bg-terminal shadow-card">
      <div className="rounded-nested-top-md border-b border-terminal-border px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-label text-terminal-muted">
          {label}
        </span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-terminal-foreground">
        {children}
      </pre>
    </div>
  )
}
