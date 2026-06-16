import { TerminalShell } from '@/components/ui/terminal-shell'

interface Props {
  label: string
  children: string
}

export function TerminalBlock({ label, children }: Props) {
  return (
    <TerminalShell label={label} bodyClassName="overflow-x-auto p-5">
      <pre className="font-mono text-xs leading-relaxed text-terminal-foreground">{children}</pre>
    </TerminalShell>
  )
}
