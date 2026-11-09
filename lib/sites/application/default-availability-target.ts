import type { Prisma, Project } from '@prisma/client'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { canonicalIntent, type ExecutionSpec } from '../domain/execution-spec'
import { snapshotOutcomeBinding } from './binding-config'
import { fenceOutcomeBindingTasks, lockSiteOutcomeAudits } from './outcome-authorization'
import { bindingForConfirmedKind } from './outcome-bindings'

const automaticAvailability = (projectId: string) => ({ projectId, slug: 'page-loads', kind: 'AVAILABILITY' as const, inferenceSource: 'automatic' })

/** Called with the Site locked after setup. Only the canonical generated
 * binding can be incorporated into a newly admitted broad Run. */
export async function readGeneratedAvailability(tx: Prisma.TransactionClient, site: Pick<Project, 'id' | 'url'>) {
  const target = normalizeAuditNavigationUrl(site.url)
  if (!target.ok) return null
  const generated = bindingForConfirmedKind('AVAILABILITY', site.url)!
  const outcome = await tx.siteOutcome.findFirst({ where: { ...automaticAvailability(site.id), enabled: true, environment: 'production' },
    select: { id: true, kind: true, expectation: true, bindingPolicy: true, authorizationRevision: true,
      bindings: { where: { enabled: true }, take: 2, select: { key: true, mechanism: true, version: true, required: true, scope: true, config: true } } } })
  const binding = outcome?.bindings[0], config = binding?.config
  if (!outcome || outcome.bindings.length !== 1 || !binding?.required || binding.key !== generated.key ||
    binding.mechanism !== 'HTTP_AVAILABILITY' || binding.scope !== null || !config || typeof config !== 'object' ||
    Array.isArray(config) || typeof config.startUrl !== 'string') return null
  const start = normalizeAuditNavigationUrl(config.startUrl)
  if (!start.ok || start.url !== target.url || canonicalIntent(config) !== canonicalIntent({ ...generated.config, startUrl: config.startUrl })) return null
  const snapshot: ExecutionSpec['outcomes'][number] = { id: outcome.id, kind: outcome.kind, expectation: outcome.expectation,
    bindingPolicy: outcome.bindingPolicy, bindings: [snapshotOutcomeBinding(outcome.kind, binding)] }
  return { snapshot, authorizationRevision: outcome.authorizationRevision }
}

/** Only the generated availability binding follows the configured Site URL. */
export async function retargetDefaultAvailability(tx: Prisma.TransactionClient, site: Pick<Project, 'id' | 'userId' | 'url'>) {
  const target = normalizeAuditNavigationUrl(site.url)
  if (!target.ok) return
  const next = bindingForConfirmedKind('AVAILABILITY', site.url)!
  const owner = automaticAvailability(site.id)
  const scope = { key: next.key, mechanism: next.mechanism, required: true, enabled: true, outcome: owner }
  const binding = await tx.outcomeExecutionBinding.findFirst({ where: scope, select: { id: true, outcomeId: true, version: true, config: true, scope: true } })
  const config = binding?.config
  if (!binding || binding.scope !== null || !config || typeof config !== 'object' || Array.isArray(config) || typeof config.startUrl !== 'string') return
  const previous = normalizeAuditNavigationUrl(config.startUrl)
  if (!previous.ok || previous.url === target.url || canonicalProductHost(previous.url) !== canonicalProductHost(target.url) ||
    canonicalIntent(config) !== canonicalIntent({ ...next.config, startUrl: config.startUrl })) return

  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM projects WHERE id = ${site.id} AND "userId" = ${site.userId}
      AND url = ${site.url} AND "deletedAt" IS NULL FOR UPDATE`
  if (!locked.length) return
  await lockSiteOutcomeAudits(tx, site.id)
  const changed = await tx.outcomeExecutionBinding.updateMany({ where: { ...scope, id: binding.id, version: binding.version },
    data: { config: next.config, version: { increment: 1 } } })
  if (changed.count) await fenceOutcomeBindingTasks(tx, { projectId: site.id, primaryAuditId: null }, binding.outcomeId, 'BINDING_CHANGED')
}
