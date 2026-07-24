import { Prisma, type TechnologyDetectionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  TECHNOLOGY_DETECTOR_VERSION,
  type DetectedTech,
  type TechnologyEvidence,
} from './tech-detect'
import type { GraphTechKind } from '@/lib/graph/types'
import { MADE_WITH_COPY } from '@/lib/marketing/copy'

export type TechnologyProfileStatus = 'complete' | 'partial' | 'unavailable' | 'not_captured'
export type TechnologyConfidenceBand = 'verified' | 'supported'

export interface VisibleTechnology {
  slug: string
  name: string
  category: GraphTechKind
  confidenceBand: TechnologyConfidenceBand
  evidence: TechnologyEvidence[]
}

export interface TechnologyRecheckDiff {
  added: string[]
  removed: string[]
  confidenceChanged: string[]
}

export interface TechnologyProfile {
  status: TechnologyProfileStatus
  detectorVersion: string | null
  detectedAt: string | null
  technologies: VisibleTechnology[]
  insight: string | null
  recheckDiff?: TechnologyRecheckDiff
}

interface InsightInput {
  score?: number | null
  rubrics?: Array<{ name: string; score: number | null }>
  flags?: Array<{ rubric: string; status?: string | null }>
}

const CATEGORY_ORDER: GraphTechKind[] = [
  'framework',
  'builder',
  'cms',
  'commerce',
  'hosting',
  'analytics',
  'monitoring',
  'payments',
  'support',
]

function statusForRead(status: TechnologyDetectionStatus): TechnologyProfileStatus {
  switch (status) {
    case 'COMPLETE':
      return 'complete'
    case 'PARTIAL':
      return 'partial'
    case 'UNAVAILABLE':
      return 'unavailable'
    default:
      return 'not_captured'
  }
}

function slugifyTechnology(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseEvidence(value: unknown): TechnologyEvidence[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is TechnologyEvidence =>
        Boolean(
          item &&
          typeof item === 'object' &&
          typeof (item as TechnologyEvidence).type === 'string' &&
          typeof (item as TechnologyEvidence).label === 'string'
        )
    )
    .map((item) => ({
      type: item.type,
      label: item.label.slice(0, 120),
    }))
    .slice(0, 4)
}

function buildInsight(
  technologies: VisibleTechnology[],
  input: InsightInput
): string | null {
  if (technologies.length === 0) return null
  const names = technologies.slice(0, 2).map((tech) => tech.name)
  const stackLabel =
    names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`
  const scoredRubrics = (input.rubrics ?? []).filter(
    (rubric): rubric is { name: string; score: number } => rubric.score !== null
  )
  const lowest = scoredRubrics.sort((a, b) => a.score - b.score)[0]
  const unresolved = (input.flags ?? []).filter(
    (flag) =>
      flag.status !== 'FIXED' &&
      flag.status !== 'IGNORED' &&
      (!lowest || flag.rubric === lowest.name)
  ).length

  if (lowest) {
    return MADE_WITH_COPY.insightWithRubric(
      stackLabel,
      lowest.name,
      lowest.score,
      unresolved
    )
  }
  if (input.score !== null && input.score !== undefined) {
    return MADE_WITH_COPY.insightWithScore(stackLabel, input.score)
  }
  return MADE_WITH_COPY.insightCount(technologies.length)
}

function visibleFromObservation(observation: {
  confidence: number
  evidence: unknown
  technology: { name: string; kind: string }
}): VisibleTechnology | null {
  if (observation.confidence < 0.8) return null
  const category = observation.technology.kind as GraphTechKind
  if (!CATEGORY_ORDER.includes(category)) return null
  return {
    slug: slugifyTechnology(observation.technology.name),
    name: observation.technology.name,
    category,
    confidenceBand: observation.confidence >= 0.9 ? 'verified' : 'supported',
    evidence: parseEvidence(observation.evidence),
  }
}

export async function persistTechnologyObservations(
  auditId: string,
  detections: DetectedTech[],
  status: Exclude<TechnologyDetectionStatus, 'NOT_CAPTURED'>,
  detectorVersion = TECHNOLOGY_DETECTOR_VERSION,
  detectedAt = new Date()
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.auditTechnologyObservation.deleteMany({ where: { auditId } })

    for (const detection of detections) {
      const technology = await tx.technology.upsert({
        where: { name: detection.name },
        create: { name: detection.name, kind: detection.kind },
        update: { kind: detection.kind },
      })
      await tx.auditTechnologyObservation.create({
        data: {
          auditId,
          technologyId: technology.id,
          confidence: detection.confidence,
          evidence: detection.evidence as unknown as Prisma.InputJsonValue,
          detectorVersion,
          detectedAt,
        },
      })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: {
        technologyDetectionStatus: status,
        technologyDetectorVersion: detectorVersion,
        technologyDetectedAt: detectedAt,
      },
    })
  })
}

export async function loadTechnologyProfile(
  auditId: string,
  insightInput: InsightInput = {}
): Promise<TechnologyProfile> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      parentId: true,
      technologyDetectionStatus: true,
      technologyDetectorVersion: true,
      technologyDetectedAt: true,
      technologyObservations: {
        orderBy: [{ confidence: 'desc' }, { technology: { name: 'asc' } }],
        select: {
          confidence: true,
          evidence: true,
          technology: { select: { name: true, kind: true } },
        },
      },
    },
  })

  if (!audit) {
    return {
      status: 'not_captured',
      detectorVersion: null,
      detectedAt: null,
      technologies: [],
      insight: null,
    }
  }

  const technologies = audit.technologyObservations
    .map(visibleFromObservation)
    .filter((technology): technology is VisibleTechnology => technology !== null)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name)
    )

  let recheckDiff: TechnologyRecheckDiff | undefined
  if (
    audit.parentId &&
    audit.technologyDetectorVersion &&
    audit.technologyDetectionStatus === 'COMPLETE'
  ) {
    const parent = await prisma.audit.findUnique({
      where: { id: audit.parentId },
      select: {
        technologyDetectorVersion: true,
        technologyDetectionStatus: true,
        technologyObservations: {
          select: {
            confidence: true,
            technology: { select: { name: true } },
          },
        },
      },
    })

    if (
      parent?.technologyDetectionStatus === 'COMPLETE' &&
      parent.technologyDetectorVersion === audit.technologyDetectorVersion
    ) {
      const current = new Map(
        audit.technologyObservations.map((item) => [item.technology.name, item.confidence])
      )
      const previous = new Map(
        parent.technologyObservations.map((item) => [item.technology.name, item.confidence])
      )
      const added = [...current.keys()].filter((name) => !previous.has(name)).sort()
      const removed = [...previous.keys()].filter((name) => !current.has(name)).sort()
      const confidenceChanged = [...current.entries()]
        .filter(([name, confidence]) => {
          const old = previous.get(name)
          return old !== undefined && (old >= 0.9) !== (confidence >= 0.9)
        })
        .map(([name]) => name)
        .sort()
      if (added.length || removed.length || confidenceChanged.length) {
        recheckDiff = { added, removed, confidenceChanged }
      }
    }
  }

  return {
    status: statusForRead(audit.technologyDetectionStatus),
    detectorVersion: audit.technologyDetectorVersion,
    detectedAt: audit.technologyDetectedAt?.toISOString() ?? null,
    technologies,
    insight: buildInsight(technologies, insightInput),
    ...(recheckDiff ? { recheckDiff } : {}),
  }
}

export function technologyNamesForPrompt(profile: TechnologyProfile): string[] {
  return profile.technologies
    .filter((tech) => ['framework', 'builder', 'cms', 'commerce', 'hosting'].includes(tech.category))
    .map((tech) => tech.name)
}
