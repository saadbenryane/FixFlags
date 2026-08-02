import { SupportMessageRole, SupportSessionStatus } from '@prisma/client'

export const SUPPORT_VISITOR_COOKIE = 'ff_support_visitor'
export const DEFAULT_SUPPORT_TENANT_SLUG = 'fixflags'

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

export interface SupportSessionProject {
  id: string
  name: string
  url: string
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
  project: SupportSessionProject | null
}

/** Intentionally unused until help-retrieval AI replies exist. Pass-through in v1. */
export async function onBeforeAgentReply(body: string): Promise<string> {
  return body
}
