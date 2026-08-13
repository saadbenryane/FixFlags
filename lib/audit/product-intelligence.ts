import type { ProductContract } from './product-contract'
import { parseProductContract } from './product-contract'

/**
 * Persistent Product Intelligence for a customer Product (Project-scoped).
 * Canon: knowledge/product-intelligence.md
 */
export interface ProductIntelligence {
  purpose: string
  firstValueJourney: string
  criticalOutcomes: string[]
  importantJourneys?: string[]
  successConditions?: string[]
  constraints?: string[]
  decisions?: { text: string; at: string }[]
  knownRisks?: string[]
  verifiedLearnings?: VerifiedLearning[]
  intentionalNotes?: string[]
  sourceReliability?: Array<{
    source: string
    status: 'reliable' | 'degraded' | 'unknown'
    lastObservedAt?: string
  }>
  source: 'heuristic' | 'user' | 'merged'
  updatedAt: string
}

export interface VerifiedLearning {
  checkId?: string
  improvementId?: string
  attemptId?: string
  summary: string
  auditId: string
  at: string
}

const MAX_LEARNINGS = 40
const MAX_INTENTIONAL = 20

/** Exact Product identity: lowercase hostname without www. */
export function canonicalProductHost(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return url.trim().replace(/^www\./i, '').toLowerCase()
  }
}

/** Stable display/capture URL for a Product. Identity lives in canonicalProductHost. */
export function canonicalProductUrl(url: string): string {
  const host = canonicalProductHost(url)
  return host ? `https://${host}` : url.trim()
}

export function productNameFromUrl(url: string): string {
  try {
    return new URL(canonicalProductUrl(url)).hostname
  } catch {
    return 'Product'
  }
}

export function parseProductIntelligence(data: unknown): ProductIntelligence | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Partial<ProductIntelligence>
  if (typeof raw.purpose !== 'string' || typeof raw.firstValueJourney !== 'string') return null
  if (!Array.isArray(raw.criticalOutcomes)) return null
  const source =
    raw.source === 'user' || raw.source === 'merged' || raw.source === 'heuristic'
      ? raw.source
      : 'heuristic'
  return {
    purpose: raw.purpose,
    firstValueJourney: raw.firstValueJourney,
    criticalOutcomes: raw.criticalOutcomes.filter((o): o is string => typeof o === 'string'),
    importantJourneys: Array.isArray(raw.importantJourneys)
      ? raw.importantJourneys.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : undefined,
    successConditions: Array.isArray(raw.successConditions)
      ? raw.successConditions.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : undefined,
    constraints: Array.isArray(raw.constraints)
      ? raw.constraints.filter((o): o is string => typeof o === 'string')
      : undefined,
    decisions: Array.isArray(raw.decisions)
      ? raw.decisions.filter(
          (d): d is { text: string; at: string } =>
            !!d && typeof d === 'object' && typeof d.text === 'string' && typeof d.at === 'string'
        )
      : undefined,
    knownRisks: Array.isArray(raw.knownRisks)
      ? raw.knownRisks.filter((o): o is string => typeof o === 'string')
      : undefined,
    verifiedLearnings: Array.isArray(raw.verifiedLearnings)
      ? raw.verifiedLearnings
          .filter(
            (l): l is VerifiedLearning =>
              !!l &&
              typeof l === 'object' &&
              typeof l.summary === 'string' &&
              typeof l.auditId === 'string' &&
              typeof l.at === 'string'
          )
          .slice(0, MAX_LEARNINGS)
      : undefined,
    intentionalNotes: Array.isArray(raw.intentionalNotes)
      ? raw.intentionalNotes.filter((o): o is string => typeof o === 'string').slice(0, MAX_INTENTIONAL)
      : undefined,
    sourceReliability: Array.isArray(raw.sourceReliability)
      ? raw.sourceReliability
          .filter(
            (item): item is NonNullable<ProductIntelligence['sourceReliability']>[number] =>
              !!item &&
              typeof item === 'object' &&
              typeof item.source === 'string' &&
              (item.status === 'reliable' ||
                item.status === 'degraded' ||
                item.status === 'unknown') &&
              (item.lastObservedAt === undefined || typeof item.lastObservedAt === 'string')
          )
          .slice(0, 20)
      : undefined,
    source,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

export function productIntelligenceFromContract(contract: ProductContract): ProductIntelligence {
  return {
    purpose: contract.purpose,
    firstValueJourney: contract.firstValueJourney,
    criticalOutcomes: [...contract.criticalOutcomes],
    source: contract.source === 'user' ? 'user' : 'heuristic',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Update contract fields on existing PI without wiping verified learnings,
 * intentional notes, known risks, constraints, or decisions.
 */
export function mergeContractIntoProductIntelligence(
  existing: ProductIntelligence | null,
  contract: ProductContract
): ProductIntelligence {
  const base = existing ?? productIntelligenceFromContract(contract)
  return {
    ...base,
    purpose: contract.purpose,
    firstValueJourney: contract.firstValueJourney,
    criticalOutcomes: [...contract.criticalOutcomes],
    source: contract.source === 'user' ? 'user' : base.source === 'heuristic' ? 'merged' : base.source,
    updatedAt: new Date().toISOString(),
  }
}

export function appendKnownRisk(
  pi: ProductIntelligence,
  risk: string
): ProductIntelligence {
  const cleaned = risk.trim()
  if (!cleaned) return pi
  const prev = pi.knownRisks ?? []
  if (prev.some((n) => n.toLowerCase() === cleaned.toLowerCase())) return pi
  return {
    ...pi,
    knownRisks: [cleaned, ...prev].slice(0, MAX_INTENTIONAL),
    source: pi.source === 'heuristic' ? 'merged' : pi.source,
    updatedAt: new Date().toISOString(),
  }
}

export function contractFromProductIntelligence(pi: ProductIntelligence): ProductContract {
  return {
    purpose: pi.purpose,
    firstValueJourney: pi.firstValueJourney,
    criticalOutcomes: [...pi.criticalOutcomes],
    inferredAt: pi.updatedAt,
    source: pi.source === 'user' ? 'user' : 'heuristic',
  }
}

/**
 * Prefer user-owned PI over a fresh heuristic. Heuristic fills gaps only when PI is heuristic/merged.
 */
export function resolveContractForCapture(
  inferred: ProductContract,
  projectPi: ProductIntelligence | null
): ProductContract {
  if (!projectPi) return inferred
  if (projectPi.source === 'user') {
    return contractFromProductIntelligence(projectPi)
  }
  // Merged / heuristic PI: keep stored purpose/journey if present; refresh outcomes lightly
  return {
    purpose: projectPi.purpose || inferred.purpose,
    firstValueJourney: projectPi.firstValueJourney || inferred.firstValueJourney,
    criticalOutcomes:
      projectPi.criticalOutcomes.length > 0 ? projectPi.criticalOutcomes : inferred.criticalOutcomes,
    inferredAt: new Date().toISOString(),
    source: 'heuristic',
  }
}

export function mergeHeuristicIntoProjectPi(
  existing: ProductIntelligence | null,
  inferred: ProductContract
): ProductIntelligence {
  if (existing?.source === 'user') {
    return { ...existing, updatedAt: existing.updatedAt }
  }
  if (!existing) {
    return productIntelligenceFromContract(inferred)
  }
  return {
    ...existing,
    purpose: existing.purpose || inferred.purpose,
    firstValueJourney: existing.firstValueJourney || inferred.firstValueJourney,
    criticalOutcomes:
      existing.criticalOutcomes.length > 0 ? existing.criticalOutcomes : inferred.criticalOutcomes,
    source: 'merged',
    updatedAt: new Date().toISOString(),
  }
}

export function appendVerifiedLearning(
  pi: ProductIntelligence,
  learning: VerifiedLearning
): ProductIntelligence {
  const prev = pi.verifiedLearnings ?? []
  const duplicate = prev.some(
    (item) =>
      item.auditId === learning.auditId &&
      item.checkId === learning.checkId &&
      item.summary.trim().toLowerCase() === learning.summary.trim().toLowerCase()
  )
  if (duplicate) return pi
  const next = [learning, ...prev].slice(0, MAX_LEARNINGS)
  return {
    ...pi,
    verifiedLearnings: next,
    updatedAt: new Date().toISOString(),
  }
}

export function appendIntentionalNote(
  pi: ProductIntelligence,
  note: string
): ProductIntelligence {
  const cleaned = note.trim()
  if (!cleaned) return pi
  const prev = pi.intentionalNotes ?? []
  if (prev.some((n) => n.toLowerCase() === cleaned.toLowerCase())) return pi
  return {
    ...pi,
    intentionalNotes: [cleaned, ...prev].slice(0, MAX_INTENTIONAL),
    source: pi.source === 'heuristic' ? 'merged' : pi.source,
    updatedAt: new Date().toISOString(),
  }
}

export function parseContractOrIntelligence(data: unknown): ProductContract | null {
  return parseProductContract(data)
}
