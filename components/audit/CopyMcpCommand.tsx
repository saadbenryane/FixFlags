'use client'

import { useState } from 'react'
import { Check, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMcpEndpoint } from '@/lib/mcp/docs-content'
import { SITE_URL } from '@/lib/marketing/copy'

interface Props {
  auditId: string
  disabled?: boolean
}

export function CopyMcpCommand({ auditId, disabled }: Props) {
  const [copied, setCopied] = useState(false)

  const endpoint = getMcpEndpoint(SITE_URL)

  const command = `I ran a FixFlags check. Fetch the results and show me what to fix:

\`\`\`
${endpoint}
Report ID: ${auditId}
\`\`\`

Run these MCP calls:
1. \`ff_get_report\` with reportId: \`${auditId}\`
2. \`ff_get_rubric\` with reportId: \`${auditId}\`, rubric: \`MESSAGE\`
3. \`ff_get_rubric\` with reportId: \`${auditId}\`, rubric: \`EXPERIENCE\`
4. \`ff_get_rubric\` with reportId: \`${auditId}\`, rubric: \`REACH\`

Or use curl:
\`\`\`bash
curl -s -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: \$FF_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"ff_get_report","params":{"reportId":"${auditId}"},"id":1}'
\`\`\``

  async function handleCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
