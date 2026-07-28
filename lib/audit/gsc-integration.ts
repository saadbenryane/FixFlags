import { getGscAccessToken, querySearchAnalytics, inspectUrl } from '@/lib/integrations/google-search-console'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

const PrismaDbNull = Prisma.DbNull

function dateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  return {
    endDate: now.toISOString().slice(0, 10),
    startDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  }
}

function hostnameFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname
  } catch {
    return raw
  }
}

export async function pullSearchPerformanceForAudit(
  auditId: string,
  userId: string,
  urls: string[]
) {
  const accessToken = await getGscAccessToken(userId)
  if (!accessToken) return

  const connection = await prisma.gscConnection.findUnique({
    where: { userId },
  })
  if (!connection) return

  const { startDate, endDate } = dateRange()

  for (const url of urls) {
    try {
      const rows = await querySearchAnalytics(
        accessToken,
        connection.siteUrl,
        startDate,
        endDate,
        ['query', 'page', 'device', 'country'],
        250
      )

      const pageRows = rows.filter((r) => {
        const pageKey = r.keys[1]
        if (!pageKey) return false
        return pageKey.includes(hostnameFromUrl(url))
      })

      if (pageRows.length > 0) {
        const batch = pageRows.map((row) => ({
          auditId,
          url,
          query: row.keys[0] ?? '',
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          device: row.keys[2] ?? 'DESKTOP',
          country: row.keys[3] ?? '',
          dateRange: `${startDate}-${endDate}`,
          userId,
        }))

        await prisma.searchPerformance.createMany({ data: batch, skipDuplicates: true })
      }
    } catch (err) {
      logger.error(
        `Failed to pull search performance for ${url}`,
        err instanceof Error ? err : new Error(String(err))
      )
    }
  }
}

export async function pullIndexStatusForAudit(
  auditId: string,
  userId: string,
  urls: string[]
) {
  const accessToken = await getGscAccessToken(userId)
  if (!accessToken) return

  const connection = await prisma.gscConnection.findUnique({
    where: { userId },
  })
  if (!connection) return

  for (const url of urls) {
    try {
      const status = await inspectUrl(accessToken, connection.siteUrl, url)
      if (!status) continue

      await prisma.indexStatus.upsert({
        where: {
          auditId_url: { auditId, url },
        },
        create: {
          auditId,
          url,
          verdict: status.verdict ?? 'NEUTRAL',
          coverageState: status.coverageState ?? '',
          robotsTxtState: status.robotsTxtState ?? '',
          indexingState: status.indexingState ?? '',
          lastCrawlTime: status.lastCrawlTime
            ? new Date(status.lastCrawlTime)
            : null,
          googleCanonical: status.googleCanonical ?? null,
          userCanonical: status.userCanonical ?? null,
          crawledAs: status.crawledAs ?? null,
          sitemap: status.sitemap ?? [],
          richResults: (status as Record<string, unknown>).richResults ?? PrismaDbNull,
          userId,
        },
        update: {
          verdict: status.verdict ?? 'NEUTRAL',
          coverageState: status.coverageState ?? '',
          robotsTxtState: status.robotsTxtState ?? '',
          indexingState: status.indexingState ?? '',
          lastCrawlTime: status.lastCrawlTime
            ? new Date(status.lastCrawlTime)
            : null,
          googleCanonical: status.googleCanonical ?? null,
          userCanonical: status.userCanonical ?? null,
          crawledAs: status.crawledAs ?? null,
          sitemap: status.sitemap ?? [],
          richResults: (status as Record<string, unknown>).richResults ?? PrismaDbNull,
        },
      })
    } catch (err) {
      logger.error(
        `Failed to pull index status for ${url}`,
        err instanceof Error ? err : new Error(String(err))
      )
    }
  }
}

export async function hasGscConnection(userId: string): Promise<boolean> {
  const count = await prisma.gscConnection.count({ where: { userId } })
  return count > 0
}

export async function pullGscDataForAudit(
  auditId: string,
  userId: string,
  urls: string[]
) {
  const connected = await hasGscConnection(userId)
  if (!connected) return

  await Promise.all([
    pullSearchPerformanceForAudit(auditId, userId, urls),
    pullIndexStatusForAudit(auditId, userId, urls),
  ])
}
