import { SupportProvider } from '@/components/live-support/SupportProvider'
import { SupportWidgetLazy } from '@/components/live-support/SupportWidgetLazy'

/** Mount live support on knowledge routes without dynamizing the marketing layout. */
export function KnowledgeSupportShell({ children }: { children: React.ReactNode }) {
  return (
    <SupportProvider>
      {children}
      <SupportWidgetLazy />
    </SupportProvider>
  )
}
