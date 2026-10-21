import { createHash } from 'node:crypto'
import { z } from 'zod'
import { flagKeyForRow } from './flag-key'

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const memberSchema = z.object({ id: z.string().min(1), key: z.string().min(1), sourceHash: hashSchema, guidanceHash: hashSchema }).strict()
export const prescriptionScopeSchema = z.object({
  version: z.literal(1), allFlags: z.boolean(), members: z.array(memberSchema).max(5000),
}).strict().superRefine((scope, context) => {
  if (new Set(scope.members.map(member => member.id)).size !== scope.members.length)
    context.addIssue({ code: 'custom', message: 'Duplicate prescription member' })
})
export type PrescriptionScope = z.infer<typeof prescriptionScopeSchema>

const sourceFields = ['source', 'checkId', 'fingerprint', 'pageUrl', 'affectedPaths', 'rubric', 'severity',
  'problem', 'evidence', 'whyItMatters', 'confidence', 'causeCertainty', 'fixConfidence', 'attentionPolicy', 'impactTag',
  'verificationRule', 'supportingObservations', 'evidenceTargets'] as const
export const guidanceFields = ['fix', 'agentPrompt', 'cursorPrompt', 'claudePrompt', 'windsurfPrompt', 'lovablePrompt', 'boltPrompt'] as const
type SourceField = typeof sourceFields[number]
type GuidanceField = typeof guidanceFields[number]
export type PrescriptionScopeFlag = { id: string; checkId: string | null; fingerprint: string | null }
  & Partial<Record<SourceField | GuidanceField, unknown>>

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]))
  return value ?? null
}
export function prescriptionHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex')
}
export function guidanceHash(value: Partial<Record<GuidanceField, unknown>>): string {
  return prescriptionHash(Object.fromEntries(guidanceFields.map(key => [key, value[key] ?? null])))
}
function sourceHash(flag: PrescriptionScopeFlag): string {
  return prescriptionHash(Object.fromEntries(sourceFields.map(key => [key, flag[key] ?? null])))
}
export function freezePrescriptionScope(flags: PrescriptionScopeFlag[], keys?: readonly string[]): PrescriptionScope {
  const selected = keys ? flags.filter(flag => keys.includes(flagKeyForRow(flag))) : flags
  return prescriptionScopeSchema.parse({ version: 1, allFlags: keys === undefined,
    members: selected.map(flag => ({ id: flag.id, key: flagKeyForRow(flag), sourceHash: sourceHash(flag), guidanceHash: guidanceHash(flag) }))
      .sort((a, b) => a.id.localeCompare(b.id)) })
}

export class PrescriptionScopeChanged extends Error {
  constructor() { super('PRESCRIPTION_SCOPE_CHANGED'); this.name = 'PrescriptionScopeChanged' }
}

/** Compare exact row membership, including additional occurrences of an admitted key. */
export function assertPrescriptionScope(scope: PrescriptionScope, flags: PrescriptionScopeFlag[], committed?: ReadonlyMap<string, string>): void {
  const keys = new Set(scope.members.map(member => member.key))
  const selected = flags.filter(flag => scope.allFlags || keys.has(flagKeyForRow(flag)))
  if (selected.length !== scope.members.length) throw new PrescriptionScopeChanged()
  const rows = new Map(selected.map(flag => [flag.id, flag]))
  for (const member of scope.members) {
    const row = rows.get(member.id)
    if (!row || flagKeyForRow(row) !== member.key || sourceHash(row) !== member.sourceHash ||
      guidanceHash(row) !== (committed?.get(member.id) ?? member.guidanceHash)) throw new PrescriptionScopeChanged()
  }
}

export const prescriptionCommitSchema = z.object({ version: z.literal(1), scopeHash: hashSchema,
  guidance: z.array(z.object({ id: z.string(), hash: hashSchema }).strict()).max(5000) }).strict()
