import { SupportMessageRole, SupportSessionStatus } from '@prisma/client'

export const SUPPORT_VISITOR_COOKIE = 'ff_support_visitor'
export const DEFAULT_SUPPORT_TENANT_SLUG = 'fixflags'

export interface SupportWidgetConfig {
  tenantSlug: string
  title: string
  greeting: string
}

export interface SupportMessageDto {
  id: string
  role: SupportMessageRole
  body: string
  createdAt: string
  senderId?: string | null
}

export interface SupportSessionDto {
  id: string
  status: SupportSessionStatus
  visitorName?: string | null
  visitorEmail?: string | null
  pageUrl?: string | null
  lastMessageAt?: string | null
  unreadByVisitor: number
  unreadByAgent: number
  createdAt: string
}

export interface SupportSessionListItem extends SupportSessionDto {
  lead?: {
    normalizedDomain: string
    latestScore: number | null
    status: string
  } | null
  user?: {
    email: string
    plan: string
  } | null
}

/** Reserved for future AI layer - pass-through in v1. */
export async function onBeforeAgentReply(body: string): Promise<string> {
  return body
}

/** Reserved for future AI auto-reply when no agent is online. */
export async function onNoAgentOnline(sessionId: string): Promise<void> {
  void sessionId
  // v1: email notification handled separately
}
