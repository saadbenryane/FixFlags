'use client'

import { Check, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildReportMcpCommand } from '@/lib/mcp/report-command-copy'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

interface Props {
  auditId: string
  disabled?: boolean
}

export function CopyMcpCommand({ auditId, disabled }: Props) {
  const { copied, copy } = useCopyToClipboard()
  const command = buildReportMcpCommand(auditId)

  async function handleCopy() {
    await copy(command, { kind: 'command', auditId })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={disabled}
      aria-label="Copy MCP commands for this report"
    >
      <Cpu className="h-4 w-4 mr-2" />
      {copied ? 'Copied!' : 'Copy MCP command'}
      {copied && <Check className="h-3 w-3 ml-1.5" />}
    </Button>
  )
}
