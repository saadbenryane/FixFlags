'use client'

import { ConversationWidget } from './ConversationWidget'

export function SupportWidget({ auditId }: { auditId?: string | null }) {
  // The shared SupportProvider owns any recorded Audit context.
  void auditId
  return <ConversationWidget supportOnly />
}
