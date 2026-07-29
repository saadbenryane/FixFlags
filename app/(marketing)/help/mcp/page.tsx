import { permanentRedirect } from 'next/navigation'

export default function HelpMcpPage() {
  permanentRedirect('/docs/integrations')
}
