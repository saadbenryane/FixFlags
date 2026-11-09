import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { requireActiveAccountForWrite } from '@/lib/auth/account-availability'
import type { Prisma, User } from '@prisma/client'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { SiteNotFound } from '@/lib/sites/domain/site-errors'
import {
  RESEARCH_CONSENT_EVENT, RESEARCH_CONSENT_VERSION,
  researchConsentPropertiesSchema, researchConsentWriteSchema,
  type ResearchConsentProperties, type ResearchConsentView,
} from './research-consent-contract'

type Owner = { projectId: string; userId: string }
type ConsentEvent = { id: string; userId: string | null; version: number; properties: unknown; createdAt: Date }
type ConsentLedger = Pick<Prisma.TransactionClient, 'siteLifecycleEvent'>
type ResearchConsentAccount = Pick<User, 'lifecycleStatus' | 'lifecycleRevision'>
export type ResearchConsentSite = { id: string; userId: string; url: string; watchTargetRevision: number; user: ResearchConsentAccount }
export const researchConsentSiteSelect = { id: true, userId: true, url: true, watchTargetRevision: true,
  user: { select: { lifecycleStatus: true, lifecycleRevision: true } } } as const

function latestResearchChoice(db: ConsentLedger, projectId: string) {
  return db.siteLifecycleEvent.findFirst({
    where: { projectId, name: RESEARCH_CONSENT_EVENT },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, userId: true, version: true, properties: true, createdAt: true },
  })
}

function appendResearchChoice(db: ConsentLedger, owner: Owner, previous: ConsentEvent | null, properties: ResearchConsentProperties) {
  // The caller holds the Site lock. Keep a strict order within one millisecond.
  const createdAt = new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1))
  return db.siteLifecycleEvent.create({ data: {
    name: RESEARCH_CONSENT_EVENT, version: 1,
    idempotencyKey: `research-consent:${owner.projectId}:${randomUUID()}`,
    userId: owner.userId, projectId: owner.projectId, createdAt, properties,
  } })
}

/** Called only by the authorized Site removal transaction with its Site row locked. */
export async function withdrawResearchConsentForSiteRemoval(tx: ConsentLedger, owner: Owner) {
  const previous = await latestResearchChoice(tx, owner.projectId)
  if (!previous) return
  const choice = researchConsentPropertiesSchema.safeParse(previous.properties)
  if (previous.version === 1 && choice.success && !choice.data.enabled) return
  await appendResearchChoice(tx, owner, previous, {
    enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, reason: 'site-removed',
  })
}

function researchAddress(raw: string) {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Invalid address')
    return { origin: url.origin, pathname: url.pathname, path: url.pathname.replace(/\/+$/, '') || '/' }
  } catch { throw new SiteRunRefusal('Site address is unavailable.', 503) }
}

export function researchSiteIdentity(url: string): string {
  const address = researchAddress(url)
  return createHash('sha256').update(`${address.origin}${address.path}`).digest('hex')
}

function hasUnambiguousResearchPath(pathname: string): boolean {
  // Servers can decode separators before resolving path segments. Keep the
  // retained path boundary conservative and reject ambiguous escapes.
  const decoded = decodeURIComponent(pathname)
  return !pathname.includes('//') && !/%2f/i.test(pathname) &&
    !/[\\%?#;]/.test(decoded) && !/%(?:[01][0-9a-f]|7f)/i.test(pathname)
}

export function researchAuditMatchesSite(siteUrl: string, auditUrl: string): boolean {
  try {
    const site = researchAddress(siteUrl)
    const audit = researchAddress(auditUrl)
    return site.origin === audit.origin && hasUnambiguousResearchPath(site.pathname) &&
      hasUnambiguousResearchPath(audit.pathname) &&
      (site.path === '/' || audit.path === site.path || audit.path.startsWith(`${site.path}/`))
  } catch { return false }
}

export function consentView(event: ConsentEvent | null, site: ResearchConsentSite): ResearchConsentView {
  const siteIdentity = researchSiteIdentity(site.url)
  const properties = researchConsentPropertiesSchema.safeParse(event?.properties)
  const enabled = Boolean(event && event.userId === site.userId && event.version === 1 && properties.success &&
    properties.data.enabled && properties.data.siteIdentity === siteIdentity &&
    site.user.lifecycleStatus === 'ACTIVE' && (properties.data.ownerLifecycleRevision ?? 0) === site.user.lifecycleRevision &&
    (properties.data.siteTargetRevision ?? 1) === site.watchTargetRevision)
  return { enabled, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: enabled ? event!.createdAt.toISOString() : null }
}

export async function loadResearchConsent(owner: Owner): Promise<ResearchConsentView> {
  const project = await prisma.project.findFirst({ where: { id: owner.projectId, userId: owner.userId, deletedAt: null },
    select: researchConsentSiteSelect })
  if (!project) throw new SiteNotFound()
  const event = await latestResearchChoice(prisma, owner.projectId)
  return consentView(event, project)
}

/** Consent is an owner-scoped, append-only choice, independent of analytics cookies. */
export async function saveResearchConsent(owner: Owner, input: unknown): Promise<ResearchConsentView> {
  const changes = researchConsentWriteSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    // An opt-in shares the account lock used by suspension and erasure.
    if (changes.enabled) await requireActiveAccountForWrite(tx, owner.userId)
    const projects = await tx.$queryRaw<Array<Pick<ResearchConsentSite, 'id' | 'url' | 'watchTargetRevision'> & ResearchConsentAccount>>`
      SELECT project.id, project.url, project."watchTargetRevision",
        account."lifecycleStatus"::text AS "lifecycleStatus", account."lifecycleRevision"
      FROM projects project JOIN users account ON account.id = project."userId"
      WHERE project.id = ${owner.projectId} AND project."userId" = ${owner.userId} AND project."deletedAt" IS NULL
      FOR UPDATE OF project`
    if (projects.length !== 1) throw new SiteNotFound()
    const previous = await latestResearchChoice(tx, owner.projectId)
    const project = projects[0]
    const site = { id: project.id, userId: owner.userId, url: project.url, watchTargetRevision: project.watchTargetRevision, user: project }
    const siteIdentity = researchSiteIdentity(project.url)
    const current = consentView(previous, site)
    const choice = researchConsentPropertiesSchema.safeParse(previous?.properties)
    const repeatsChoice = previous?.userId === owner.userId && previous.version === 1 && choice.success &&
      choice.data.enabled === changes.enabled && ('reason' in choice.data || choice.data.siteIdentity === siteIdentity)
    if (current.enabled === changes.enabled && (!previous || repeatsChoice)) return current
    const event = await appendResearchChoice(tx, owner, previous, {
      enabled: changes.enabled, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity,
      ownerLifecycleRevision: project.lifecycleRevision, siteTargetRevision: project.watchTargetRevision,
    })
    return consentView(event, site)
  })
}
