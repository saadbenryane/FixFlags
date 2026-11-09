import type { AuditExecutionTask } from '@prisma/client'
import { readArtifact, TaskFailure } from './contracts'
import { browserArtifactSchema, screenshotSnapshotSchema } from './snapshots'
import { dedupeConsoleErrors } from '../console-evidence'
import { z } from 'zod'
import { loadingObservationSchema } from '../checks/loading-evidence'
import { documentEvidenceWithheld } from '../browser/document-evidence'
import { captureObservationKey } from '../browser/observation-scope'
import { isSuccessfulPublicGetStatus } from '../http-evidence'

export const desktopCollectionSnapshotSchema = screenshotSnapshotSchema.pick({
  desktopHttpStatus: true, desktopFinalUrl: true, collectionRestrictions: true, publicSignInRedirect: true,
}).extend({ desktopLoadExperience: z.object({ observation: loadingObservationSchema }).nullable().optional() }).strip()

/** A settled native document observation can establish collection independently
 * of metadata parsing. This does not establish any detector's passing result. */
export function hasRecordedDesktopCollection(snapshot: unknown, pageUrl: string): boolean {
  const parsed = desktopCollectionSnapshotSchema.safeParse(snapshot)
  if (!parsed.success || !z.string().url().safeParse(pageUrl).success) return false
  const data = parsed.data, observation = data.desktopLoadExperience?.observation
  return Boolean(!data.publicSignInRedirect && observation && observation.device === 'desktop' && observation.ready && !observation.restricted && !observation.interrupted &&
    !documentEvidenceWithheld(data.collectionRestrictions) && data.desktopHttpStatus != null && isSuccessfulPublicGetStatus(data.desktopHttpStatus) &&
    data.desktopFinalUrl && new URL(data.desktopFinalUrl).href === new URL(observation.scope.finalUrl).href &&
    new URL(pageUrl).href === new URL(observation.scope.pageUrl).href && captureObservationKey(observation.scope) !== 'unknown')
}

type BrowserTask = Pick<AuditExecutionTask, 'workKind' | 'workState' | 'workInput' | 'workResult'>

function readBrowserProfiles(tasks: Iterable<BrowserTask>) {
  const sources = [...tasks].filter(task => task.workKind === 'browser' && task.workState === 'COMPLETED' && task.workResult)
    .flatMap(task => {
      const artifact = readArtifact(task.workResult, 'browser')
      const device = task.workInput && typeof task.workInput === 'object' && !Array.isArray(task.workInput) ? task.workInput.device : undefined
      const data = browserArtifactSchema.parse(artifact.data)
      // Older captures could retain a partial document as if it were complete.
      return data.snapshot.desktopHttpStatus === 206 ? [] : [{ device, collectedAt: artifact.collectedAt, data }]
    })
  const desktop = sources.find(source => source.device !== 'mobile'), mobile = sources.find(source => source.device === 'mobile')
  if (desktop && mobile && desktop.data.pageId !== mobile.data.pageId) throw new TaskFailure('BROWSER_SCOPE_MISMATCH', false)
  return { desktop, mobile }
}

/** Join only each profile's own observations. Metadata and rendered document
 * conditions remain desktop facts, including when mobile collection fails. */
function joinBrowserProfiles({ desktop, mobile }: ReturnType<typeof readBrowserProfiles>) {
  if (!desktop || !mobile) return desktop ?? mobile ?? null
  const desk = desktop.data.snapshot, phone = mobile.data.snapshot
  const errors = dedupeConsoleErrors([...desk.consoleErrors, ...phone.consoleErrors])
  const baseline = desk.consoleCoverage ?? phone.consoleCoverage
  const coverage = baseline ? {
    ...baseline, desktop: desk.consoleCoverage?.desktop ?? baseline.desktop, mobile: phone.consoleCoverage?.mobile ?? baseline.mobile,
    messagesTruncated: desk.consoleCoverage?.messagesTruncated || phone.consoleCoverage?.messagesTruncated || errors.length > 500,
  } : undefined
  return { collectedAt: Date.parse(desktop.collectedAt) <= Date.parse(mobile.collectedAt) ? desktop.collectedAt : mobile.collectedAt,
    data: browserArtifactSchema.parse({ ...desktop.data, snapshot: { ...desk,
      mobileUrl: phone.mobileUrl, mobileBase64: phone.mobileBase64,
      consoleErrors: errors.slice(0, 500), consoleCoverage: coverage,
      captureStatus: { ...desk.captureStatus, mobile: phone.captureStatus.mobile },
      captureFailures: [...desk.captureFailures, ...phone.captureFailures],
      captureMetrics: phone.captureMetrics ? { ...phone.captureMetrics,
        desktopLoadExperience: desk.desktopLoadExperience ?? phone.captureMetrics.desktopLoadExperience ?? null } : null,
      loadExperience: phone.loadExperience, motionWindow: phone.motionWindow,
      mobileAccessibility: phone.mobileAccessibility,
      networkFailures: [...desk.networkFailures ?? [], ...phone.networkFailures ?? []],
    } }) }
}

export function readBrowserEvidence(tasks: Iterable<BrowserTask>) {
  return joinBrowserProfiles(readBrowserProfiles(tasks))
}

export function readBrowserPageCheckEvidence(tasks: Iterable<BrowserTask>) {
  const profiles = readBrowserProfiles(tasks)
  const desktopDiverted = profiles.desktop?.data.snapshot.publicSignInRedirect === true
  const mobileDiverted = (profiles.mobile ?? profiles.desktop)?.data.snapshot.mobileSignInRedirect === true
  // Keep a usable mobile checkpoint when its desktop peer was diverted.
  // Legacy combined checkpoints lack that independently qualified peer.
  const source = joinBrowserProfiles({
    desktop: desktopDiverted ? undefined : profiles.desktop,
    mobile: mobileDiverted ? undefined : profiles.mobile,
  })
  return { source, desktopDiverted, mobileDiverted }
}
