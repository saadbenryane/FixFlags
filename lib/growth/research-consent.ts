import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import {
  RESEARCH_CONSENT_EVENT, RESEARCH_CONSENT_VERSION,
  researchConsentPropertiesSchema, researchConsentWriteSchema,
  type ResearchConsentView,
} from './research-consent-contract'

type Owner = { projectId: string; userId: string }
type ConsentEvent = { id: string; userId: string | null; version: number; properties: unknown; createdAt: Date }

function researchAddress(raw: string) {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Invalid address')
    return { origin: url.origin, path: url.pathname.replace(/\/+$/, '') || '/' }
  } catch { throw new SiteRunRefusal('Site address is unavailable.', 503) }
}

export function researchSiteIdentity(url: string): string {
  const address = researchAddress(url)
  return createHash('sha256').update(`${address.origin}${address.path}`).digest('hex')
}

export function researchAuditMatchesSite(siteUrl: string, auditUrl: string): boolean {
  try {
    const site = researchAddress(siteUrl)
    const audit = researchAddress(auditUrl)
    return site.origin === audit.origin && (site.path === '/' || audit.path === site.path || audit.path.startsWith(`${site.path}/`))
  } catch { return false }
}

export function consentView(event: ConsentEvent | null, userId: string, siteIdentity: string): ResearchConsentView {
  const properties = researchConsentPropertiesSchema.safeParse(event?.properties)
  const enabled = Boolean(event && event.userId === userId && event.version === 1 && properties.success &&
    properties.data.enabled && properties.data.siteIdentity === siteIdentity)
  return { enabled, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: enabled ? event!.createdAt.toISOString() : null }
}

export async function loadResearchConsent(owner: Owner): Promise<ResearchConsentView> {
  const project = await prisma.project.findFirst({ where: { id: owner.projectId, userId: owner.userId, deletedAt: null }, select: { id: true, url: true } })
  if (!project) throw new SiteRunRefusal('Site not found.', 404)
  const event = await prisma.siteLifecycleEvent.findFirst({
    where: { projectId: owner.projectId, name: RESEARCH_CONSENT_EVENT },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  return consentView(event, owner.userId, researchSiteIdentity(project.url))
}

/** Consent is an owner-scoped, append-only choice, independent of analytics cookies. */
export async function saveResearchConsent(owner: Owner, input: unknown): Promise<ResearchConsentView> {
  const changes = researchConsentWriteSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const projects = await tx.$queryRaw<Array<{ id: string; url: string }>>`
      SELECT id, url FROM projects WHERE id = ${owner.projectId}
        AND "userId" = ${owner.userId} AND "deletedAt" IS NULL FOR UPDATE`
    if (projects.length !== 1) throw new SiteRunRefusal('Site not found.', 404)
    const previous = await tx.siteLifecycleEvent.findFirst({
      where: { projectId: owner.projectId, name: RESEARCH_CONSENT_EVENT },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const siteIdentity = researchSiteIdentity(projects[0].url)
    const current = consentView(previous, owner.userId, siteIdentity)
    const previousProperties = researchConsentPropertiesSchema.safeParse(previous?.properties)
    const sameScope = previous?.userId === owner.userId && previous.version === 1 &&
      previousProperties.success && previousProperties.data.siteIdentity === siteIdentity
    if (current.enabled === changes.enabled && (!previous || (sameScope && previousProperties.success && previousProperties.data.enabled === changes.enabled))) return current
    // Owner writes serialize on the Site. Keep a strict order even within one millisecond.
    const createdAt = new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1))
    const event = await tx.siteLifecycleEvent.create({ data: {
      name: RESEARCH_CONSENT_EVENT, version: 1,
      idempotencyKey: `research-consent:${owner.projectId}:${randomUUID()}`,
      userId: owner.userId, projectId: owner.projectId, createdAt,
      properties: { enabled: changes.enabled, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity },
    } })
    return consentView(event, owner.userId, siteIdentity)
  })
}
