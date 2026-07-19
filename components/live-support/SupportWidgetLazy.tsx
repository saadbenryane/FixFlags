'use client'

import dynamic from 'next/dynamic'

const SupportWidget = dynamic(
  () => import('@/components/live-support/SupportWidget').then((m) => m.SupportWidget),
  { ssr: false }
)

export function SupportWidgetLazy({ auditId }: { auditId?: string | null }) {
  return <SupportWidget auditId={auditId} />
}
