import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import { ANON_AUDIT_IDS_COOKIE, readAnonAuditIds } from '@/lib/audit/usage'
import { extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'

async function leadIdForDomain(domain: string | null): Promise<string | null> {
  if (!domain) return null
  const lead = await prisma.lead.findUnique({
    where: { normalizedDomain: domain },
    select: { id: true },
  })
  return lead?.id ?? null
}

async function domainFromAuditId(auditId: string): Promise<string | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { url: true, normalizedDomain: true },
  })
  if (!audit) return null
  return audit.normalizedDomain ?? normalizeDomain(audit.url)
}

async function domainFromAnonCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length === 0) return null

  const audit = await prisma.audit.findFirst({
    where: { id: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { url: true, normalizedDomain: true },
  })
  if (!audit) return null
  return audit.normalizedDomain ?? normalizeDomain(audit.url)
}

async function domainFromUserLatestAudit(userId: string): Promise<string | null> {
  const audit = await prisma.audit.findFirst({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { url: true, normalizedDomain: true },
  })
  if (!audit) return null
  return audit.normalizedDomain ?? normalizeDomain(audit.url)
}

/** Resolve a Lead row id from session context; never links fixflags.com from report pages. */
export async function resolveLeadIdForSession(input: {
  pageUrl?: string | null
  userId?: string | null
  auditId?: string | null
}): Promise<string | null> {
  const explicitAuditId = input.auditId ?? extractAuditIdFromPageUrl(input.pageUrl)
  if (explicitAuditId) {
    const domain = await domainFromAuditId(explicitAuditId)
    const leadId = await leadIdForDomain(domain)
    if (leadId) return leadId
  }

  if (input.userId) {
    const domain = await domainFromUserLatestAudit(input.userId)
    const leadId = await leadIdForDomain(domain)
    if (leadId) return leadId
  }

  const anonDomain = await domainFromAnonCookie()
  return leadIdForDomain(anonDomain)
}

export { extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'
