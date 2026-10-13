import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AdminActor } from '@/lib/auth/require-admin'
import { assertAdminActor } from './security'
import { adminPagination, readAdminListQuery } from './list-query'
import { resolveEffectiveEntitlements } from '@/lib/billing/effective-entitlements'

export function adminRead<T>(
  actor: AdminActor,
  query: (db: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (db) => {
      await assertAdminActor(db, actor)
      return query(db)
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  )
}
export async function loadAdminOverview(actor: AdminActor) {
  return adminRead(actor, async (db) => {
    const [sites, customers, openSupport, queued, uncertain, failures] = await Promise.all([
      db.project.count({ where: { deletedAt: null } }),
      db.user.count(),
      db.supportSession.count({
        where: { status: { not: 'CLOSED' }, lastMessageAt: { not: null } },
      }),
      db.adminOperation.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
      db.adminOperation.count({ where: { status: 'INDETERMINATE' } }),
      db.audit.count({
        where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 86400000) } },
      }),
    ])
    return { sites, customers, openSupport, queued, uncertain, failures }
  })
}
export async function loadAdminSites(actor: AdminActor, params: { q?: string; page?: string }) {
  return adminRead(actor, async (db) => {
    const { q, page } = readAdminListQuery(params)
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { canonicalHost: { contains: q, mode: 'insensitive' } },
              { id: q },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
    const total = await db.project.count({ where }),
      pagination = adminPagination(page, total)
    const rows = await db.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        canonicalHost: true,
        watchInterval: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        user: { select: { id: true, email: true, lifecycleStatus: true } },
        uptimeMonitor: { select: { state: true, lastCheckedAt: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    })
    return { rows, q, total, pagination }
  })
}
export async function loadAdminCustomer(actor: AdminActor, id: string) {
  return adminRead(actor, async (db) => {
    const user = await db.user.findUnique({
      where: { id },
      include: {
        entitlementGrants: { orderBy: { createdAt: 'desc' } },
        projects: {
          where: { deletedAt: null },
          select: { id: true, name: true, canonicalHost: true },
        },
        billingSnapshots: { orderBy: { observedAt: 'desc' } },
        _count: { select: { sessions: true } },
      },
    })
    if (!user) return null
    // Explicit DTO avoids auth secrets, provider identifiers and all credential relations.
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      status: user.subscriptionStatus,
      lifecycleStatus: user.lifecycleStatus,
      effective: resolveEffectiveEntitlements(user, user.entitlementGrants),
      sites: user.projects,
      grants: user.entitlementGrants.map((g) => ({
        id: g.id,
        plan: g.plan,
        expiresAt: g.expiresAt.toISOString(),
        revoked: Boolean(g.revokedAt),
      })),
      subscription: user.billingSnapshots[0]
        ? {
            status: user.billingSnapshots[0].status,
            cancelAtPeriodEnd: user.billingSnapshots[0].cancelAtPeriodEnd,
            cancelAt: user.billingSnapshots[0].cancelAt?.toISOString(),
            scheduleId: user.billingSnapshots[0].scheduleId,
            periodEnd: user.billingSnapshots[0].currentPeriodEnd?.toISOString(),
            observedAt: user.billingSnapshots[0].observedAt.toISOString(),
          }
        : null,
      hasSubscription: Boolean(user.stripeSubscriptionId),
      licensedSiteQuantity: user.licensedSiteQuantity,
      sessions: user._count.sessions,
    }
  })
}
export async function loadAdminSite(actor: AdminActor, id: string) {
  return adminRead(actor, (db) =>
    db.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        canonicalHost: true,
        deletedAt: true,
        watchInterval: true,
        watchEveryMinutes: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        watchLastError: true,
        notificationLevel: true,
        notifyOnRecovery: true,
        accountChecksEnabled: true,
        user: { select: { id: true, email: true, lifecycleStatus: true } },
        audits: {
          take: 10,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, status: true, createdAt: true, failureCode: true },
        },
        testAccounts: { select: { id: true, state: true, lastCheckedAt: true } },
        uptimeMonitor: {
          select: { state: true, enabled: true, lastCheckedAt: true, nextProbeAt: true },
        },
        shopifyShops: { select: { id: true, shopDomain: true } },
      },
    }),
  )
}
export async function loadAdminBilling(actor: AdminActor, params: { page?: string; q?: string }) {
  return adminRead(actor, async (db) => {
    const { q, page } = readAdminListQuery(params)
    const where: Prisma.BillingLedgerEntryWhereInput = q
      ? {
          OR: [
            { userId: q },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { providerId: q },
          ],
        }
      : {}
    const total = await db.billingLedgerEntry.count({ where }),
      pagination = adminPagination(page, total)
    const payments = await db.billingLedgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        kind: true,
        userId: true,
        user: { select: { email: true } },
        amountMinor: true,
        currency: true,
        status: true,
        occurredAt: true,
        planAtPayment: true,
        providerId: true,
        paymentReference: true,
      },
    })
    const refunded = await db.billingLedgerEntry.groupBy({
      by: ['paymentReference'],
      where: {
        kind: 'REFUND',
        status: { in: ['SUCCEEDED', 'PENDING'] },
        paymentReference: {
          in: payments.map((p) => p.paymentReference).filter((p): p is string => Boolean(p)),
        },
      },
      _sum: { amountMinor: true },
    })
    const rows = payments.map((p) => ({
      ...p,
      refundableMinor: p.paymentReference
        ? Math.max(
            0,
            p.amountMinor -
              (refunded.find((r) => r.paymentReference === p.paymentReference)?._sum.amountMinor ??
                0),
          )
        : 0,
    }))
    const cash = await db.billingLedgerEntry.groupBy({
      by: ['currency', 'kind'],
      where: {
        ...where,
        status: 'SUCCEEDED',
        occurredAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      _sum: { amountMinor: true },
      _count: true,
    })
    const costs = await db.auditRunCost.aggregate({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        estimatedCostUsd: { not: null },
        pricingBasis: 'CONFIGURED_ESTIMATE',
      },
      _sum: { estimatedCostUsd: true },
      _count: true,
    })
    const unpriced = await db.auditRunCost.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, estimatedCostUsd: null },
    })
    const legacy = await db.auditRunCost.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        pricingBasis: 'LEGACY_ESTIMATE',
      },
    })
    const missing = await db.audit.count({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        runCost: null,
      },
    })
    const cashTotals = Array.from(new Set(cash.map((c) => c.currency))).map((currency) => {
      const records = cash.filter((c) => c.currency === currency),
        received = records
          .filter((c) => c.kind !== 'REFUND')
          .reduce((sum, c) => sum + (c._sum.amountMinor ?? 0), 0),
        refunded = records
          .filter((c) => c.kind === 'REFUND')
          .reduce((sum, c) => sum + (c._sum.amountMinor ?? 0), 0)
      return { currency, received, refunded, net: received - refunded }
    })
    return {
      legacy,
      missing,
      cashTotals,
      rows,
      cash,
      total,
      pagination,
      q,
      estimatedCost: costs._sum.estimatedCostUsd?.toNumber() ?? null,
      priced: costs._count,
      unpriced,
    }
  })
}
export async function loadAdminActivity(
  actor: AdminActor,
  params: { page?: string; operation?: string },
) {
  return adminRead(actor, async (db) => {
    const where = params.operation ? { id: params.operation } : {},
      total = await db.adminOperation.count({ where }),
      pagination = adminPagination(readAdminListQuery(params).page, total)
    const rows = await db.adminOperation.findMany({
      where,
      select: {
        id: true,
        action: true,
        actorId: true,
        targetId: true,
        targetType: true,
        reason: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        events: {
          orderBy: { sequence: 'asc' },
          select: { id: true, action: true, type: true, occurredAt: true, detail: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    })
    return { rows, total, pagination }
  })
}
