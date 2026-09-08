import { prisma } from '@/lib/db'
import { fetchAndParseMetadataWithHeaders } from '@/lib/audit/metadata'
import { runMetadataChecks, runOgImageUrlCheck } from '@/lib/audit/checks/metadata-checks'
import { runSeoChecks } from '@/lib/audit/checks/seo'
import { runAuthCheckoutChecks } from '@/lib/audit/checks/auth-checkout'
import { runConversionFrictionChecks } from '@/lib/audit/checks/conversion-friction'
import { runSecurityHeaderChecks } from '@/lib/audit/checks/security-headers'
import { detectPagePurpose } from '@/lib/audit/page-purpose'
import { logger } from '@/lib/logger'

const CAP = 8

const GROUP_FOR: Record<string, string> = {
  'friction-no-commitment-path': 'Revenue',
  'friction-trial-commitment-unclear': 'Revenue',
  'friction-form-too-many-fields': 'Revenue',
  'checkout-link-dead': 'Revenue',
  'auth-page-broken': 'Revenue',
  'og-image-missing': 'Search',
  'og-image-broken': 'Search',
  'canonical-mismatch': 'Search',
  'noindex-meta': 'Search',
  'security-csp-missing': 'Technical',
  'security-hsts-missing': 'Technical',
  'security-headers-missing': 'Technical',
}

export async function runIntegrityImprove(pathId: string): Promise<number> {
  const path = await prisma.revenuePath.findUnique({
    where: { id: pathId },
    include: { shop: true },
  })
  if (!path || path.shop.uninstalledAt) return 0
  if (path.health !== 'GREEN') return 0

  try {
    const { metadata, responseHeaders } = await fetchAndParseMetadataWithHeaders(path.storefrontUrl)
    const purpose = detectPagePurpose(metadata, path.storefrontUrl)
    const flags = [
      ...runMetadataChecks(metadata),
      ...(await runOgImageUrlCheck(path.storefrontUrl, metadata)),
      ...(await runSeoChecks(path.storefrontUrl, metadata)),
      ...(await runAuthCheckoutChecks(path.storefrontUrl, metadata)),
      ...runConversionFrictionChecks(metadata, purpose),
      ...runSecurityHeaderChecks(path.storefrontUrl, responseHeaders ?? null),
    ]
      .filter((flag) => GROUP_FOR[flag.checkId])
      .slice(0, CAP)

    await prisma.$transaction([
      prisma.improveItem.deleteMany({ where: { pathId } }),
      ...flags.map((flag) =>
        prisma.improveItem.create({
          data: {
            pathId,
            group: GROUP_FOR[flag.checkId] ?? 'Technical',
            title: flag.problem,
            why: flag.evidence,
            checkId: flag.checkId,
          },
        })
      ),
    ])
    return flags.length
  } catch (error) {
    logger.warn('Integrity Improve failed', {
      pathId,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
