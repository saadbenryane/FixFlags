'use client'

import { Monitor, Smartphone } from 'lucide-react'
import type { PreviewDevice } from '@/components/report/WorkspaceBrowserPanel'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceDeviceToggleProps {
  device: PreviewDevice
  onDeviceChange: (device: PreviewDevice) => void
  className?: string
}

/**
 * Icon-only Desktop / Mobile control for the Product header. Lives next to
 * Preview so the viewer switches viewport without leaving the stage chrome.
 */
export function WorkspaceDeviceToggle({
  device,
  onDeviceChange,
  className,
}: WorkspaceDeviceToggleProps) {
  return (
    <SegmentedControl
      size="lg"
      value={device}
      onValueChange={(value) => onDeviceChange(value as PreviewDevice)}
      aria-label={REPORT_COPY.workspace.panels.deviceToggleLabel}
      className={cn('shrink-0', className)}
      items={[
        {
          value: 'desktop',
          'aria-label': REPORT_COPY.workspace.panels.desktopDevice,
          label: <Monitor className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          value: 'mobile',
          'aria-label': REPORT_COPY.workspace.panels.mobileDevice,
          label: <Smartphone className="h-3.5 w-3.5" aria-hidden />,
        },
      ]}
    />
  )
}
