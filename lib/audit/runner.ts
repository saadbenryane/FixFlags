import { prisma } from '../db'
import { captureScreenshots } from './screenshot'
import { fetchAndParseMetadata } from './metadata'
import { fetchPageSpeedData } from './pagespeed'
import { runAllChecks, computeAreaScores } from './checks'
import { runJudge } from './judge'
import { persistAuditResults } from './persist'
import { diffFindingsAgainstParent } from './diff-findings'
import { incrementUsageOnComplete } from './usage'

export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)

  const url = audit.url

  // Clean partial results from a previous attempt
  await prisma.screenshot.deleteMany({ where: { auditId } })

  // Phase 1 — Capture
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'CAPTURING', startedAt: new Date(), errorMsg: null },
  })

  let desktopBase64: string | null = null
  let mobileBase64: string | null = null
  let consoleErrors: Array<{ type: string; text: string }> = []

  try {
    const screenshots = await captureScreenshots(url, auditId)
    desktopBase64 = screenshots.desktopBase64
    mobileBase64 = screenshots.mobileBase64
    consoleErrors = screenshots.consoleErrors

    if (screenshots.desktopUrl) {
      await prisma.screenshot.create({
        data: {
          auditId,
          device: 'DESKTOP',
          url: screenshots.desktopUrl,
          width: 1280,
          height: 900,
        },
      })
    }
    if (screenshots.mobileUrl) {
      await prisma.screenshot.create({
        data: {
          auditId,
          device: 'MOBILE',
          url: screenshots.mobileUrl,
          width: 375,
          height: 812,
        },
      })
    }
  } catch (err) {
    console.error('Screenshot phase failed, continuing:', err)
  }

  // Fetch metadata + PageSpeed in parallel
  let metadata
  let pagespeed
  try {
    ;[metadata, pagespeed] = await Promise.all([
      fetchAndParseMetadata(url),
      fetchPageSpeedData(url),
    ])
  } catch (err) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'FAILED',
        errorMsg: `Failed to fetch page: ${(err as Error).message}`,
      },
    })
    throw err
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'CHECKING',
      htmlMetadata: metadata as never,
      performanceData: { desktop: pagespeed.desktop, mobile: pagespeed.mobile } as never,
      consoleErrors: consoleErrors as never,
    },
  })

  // Phase 2 — Deterministic checks
  const deterministicFindings = await runAllChecks(
    url,
    metadata,
    pagespeed.desktop,
    pagespeed.mobile,
    consoleErrors
  )

  const areaScores = computeAreaScores(deterministicFindings, pagespeed.desktop, pagespeed.mobile)

  // Phase 3 — AI judge (required; retry once)
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING' },
  })

  let judgeOutput
  try {
    judgeOutput = await runJudge(
      url,
      metadata,
      pagespeed.desktop,
      pagespeed.mobile,
      deterministicFindings,
      desktopBase64,
      mobileBase64
    )
  } catch (firstErr) {
    console.error('AI judge failed, retrying once:', firstErr)
    try {
      judgeOutput = await runJudge(
        url,
        metadata,
        pagespeed.desktop,
        pagespeed.mobile,
        deterministicFindings,
        desktopBase64,
        mobileBase64
      )
    } catch (secondErr) {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'FAILED',
          errorMsg: `AI analysis unavailable: ${(secondErr as Error).message}`,
        },
      })
      throw secondErr
    }
  }

  await persistAuditResults(auditId, judgeOutput, deterministicFindings, areaScores)

  if (audit.parentId) {
    await diffFindingsAgainstParent(auditId, audit.parentId)
  }

  if (audit.userId) {
    await incrementUsageOnComplete(audit.userId)
  }
}
