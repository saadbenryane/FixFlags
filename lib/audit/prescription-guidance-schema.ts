import { z } from 'zod'
import type { ExistingFlagForPrescription } from './flag-types'
import type { PrescriptionOutput } from './judge-prescription-schema'
import { toJsonSchema, toOpenApiNullableSchema, stripFormatKeyword } from './zod-json-schema'
import { formatCombinedRepairGuidance, formatInspectionGuidance } from '@/lib/improvements/repair-guidance'
import { REPAIR_GUIDANCE_COPY as C } from '@/lib/marketing/copy/repair-guidance'

const inspectionPlan = z.object({
  inspection: z.string().trim().min(15).max(240).describe('A concise plain-language subject to inspect, naming the recorded target. Noun phrase only. No opening command, diagnosis, code markup or angle brackets.'),
  changeCondition: z.string().trim().min(20).max(240).describe('An unconfirmed, evidence-based condition that would justify a change. Subject and predicate, without an opening if/when. Do not predict business outcomes.'),
  changeIfConfirmed: z.string().trim().min(15).max(320).nullable().describe('A plain-language action only if the condition is confirmed. No code markup, angle brackets, example URLs, placeholder values, guessed assets, file paths or product claims. Name attributes in plain text. Null when no specific change is supported.'),
  preserve: z.string().trim().min(10).max(200).describe('The named existing behavior or surrounding elements that must remain unchanged. Plain noun phrase only. No code markup or angle brackets.'),
}).strict()

const repairTask = z.object({
  fix: z.string().trim().min(20).max(1200).describe('Concise procedural repair steps for the established recorded failure. Name its target. Preserve working behavior. No business predictions, invented file paths or unrelated work.'),
  agentPrompt: z.string().trim().min(20).max(1200).nullable().describe('The same bounded repair task, or null when fix is complete. No new diagnosis or additional scope.'),
}).strict()

function providerSchema(flags: readonly ExistingFlagForPrescription[]) {
  const members = new Map<string, ExistingFlagForPrescription>()
  for (const flag of flags) {
    if (!flag.flagKey.trim() || !['flag', 'recommendation'].includes(flag.attention || ''))
      throw new Error('Guidance requires an exact identity and server-owned Attention')
    if (!['MESSAGE', 'EXPERIENCE', 'REACH'].includes(flag.rubric)) throw new Error('Guidance requires a recorded rubric')
    if (members.has(flag.flagKey) && (members.get(flag.flagKey)!.attention !== flag.attention || members.get(flag.flagKey)!.rubric !== flag.rubric))
      throw new Error('Guidance identity has conflicting Attention')
    members.set(flag.flagKey, flag)
  }
  return z.object({ flagPrescriptions: z.object(Object.fromEntries([...members].map(([key, flag]) =>
    [key, flag.attention === 'recommendation' ? inspectionPlan : repairTask]))).strict() }).strict()
}

export function prescriptionGuidanceJsonSchema(flags: readonly ExistingFlagForPrescription[], provider: 'openai' | 'anthropic') {
  const schema = toJsonSchema(providerSchema(flags))
  return (provider === 'openai' ? stripFormatKeyword(schema) : toOpenApiNullableSchema(schema)) as Record<string, unknown>
}

const unsupportedImpact = /\b(?:increas\w*|improv\w*|boost\w*|enhanc\w*|driv\w*|maximi\w*|grow\w*|reduc\w*|decreas\w*)\b[^.!?\n]{0,80}\b(?:revenue|conversions?|retention|traffic|ranking|search visibility|engagement|abandonment|customer satisfaction)\b/i
const repositoryPath = /\b(?:src|app|pages|components)\/[a-z0-9_./-]+\.(?:tsx?|jsx?|vue|svelte)\b/gi
const urlTokens = (text: string) => (text.match(/https?:\/\/[^\s<>"']+/g) || []).map(url => url.replace(/[.,;:!?]+$/, ''))
const tokens = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
const common = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'are', 'before', 'after', 'when', 'where', 'should', 'would', 'without', 'into', 'any', 'not', 'page', 'website', 'site', 'issue', 'problem', 'current', 'currently', 'user', 'users', 'visitor', 'visitors', 'customer', 'customers', 'make', 'more', 'ensure'])

function validateTaskText(texts: readonly string[], source: ExistingFlagForPrescription) {
  const text = texts.join(' ')
  if (text.includes('\u2014')) throw new Error(`Invalid prescription output: ${source.flagKey} must use plain punctuation`)
  const impact = text.match(unsupportedImpact)?.[0]
  if (impact) throw new Error(`Invalid prescription output: ${source.flagKey} predicts an unmeasured business outcome: ${JSON.stringify(impact.slice(0, 160))}. Remove that claim and describe only the supported inspection or repair`)
  const recordedText = [source.problem, source.evidence, source.pageUrl,
    ...source.supportingObservations?.flatMap(observation => [observation.evidence, observation.pageUrl]) || []].filter(Boolean).join(' ')
  if ((text.match(repositoryPath) || []).some(path => !recordedText.includes(path)))
    throw new Error(`Invalid prescription output: ${source.flagKey} invents a repository path`)
  for (const markup of text.match(/<[a-z][^>]*>/gi) || []) {
    for (const match of markup.matchAll(/\b(?:content|href|src|id|class|action|value)\s*=\s*["']([^"']*)["']/gi)) {
      if (!match[1] || !recordedText.includes(match[1]))
        throw new Error(`Invalid prescription output: ${source.flagKey} invents an attribute value: ${JSON.stringify(match[0].slice(0, 160))}. Describe how to select the verified value instead, without markup or a placeholder`)
    }
  }
  for (const match of text.matchAll(/<[a-z][^>]*>([^<]+)<\/[a-z][^>]*>/gi)) {
    if (match[1].trim() && !recordedText.includes(match[1].trim()))
      throw new Error(`Invalid prescription output: ${source.flagKey} invents replacement content`)
  }
  const recordedUrls = new Set(urlTokens(recordedText))
  if (urlTokens(text).some(url => !recordedUrls.has(url)))
    throw new Error(`Invalid prescription output: ${source.flagKey} introduces an unrecorded URL or asset`)
  const assets = text.match(/(?:\/|\b)[a-z0-9_-]+(?:\/[a-z0-9_.-]+)*\.(?:png|jpe?g|webp|gif|svg|ico)\b/gi) || []
  if (assets.some(asset => !recordedText.includes(asset)))
    throw new Error(`Invalid prescription output: ${source.flagKey} guesses an unrecorded asset location`)
  const pages = new Set([source.pageUrl, ...source.supportingObservations?.map(observation => observation.pageUrl) || []].filter(Boolean))
  if (pages.size > 1 && /\b(?:main page|homepage only|home page only)\b/i.test(text))
    throw new Error(`Invalid prescription output: ${source.flagKey} narrows a grouped finding to one page`)
  const recorded = tokens(`${source.problem} ${source.evidence}`)
  if ([...tokens(text)].filter(token => !common.has(token) && recorded.has(token)).length < 2)
    throw new Error(`Invalid prescription output: ${source.flagKey} does not identify its recorded target`)
}

/** Compatibility fields and aggregate tasks come from authoritative source, not a second model narrative. */
export function composePrescriptionRubrics(flags: readonly ExistingFlagForPrescription[], prescriptions: PrescriptionOutput['flagPrescriptions']): PrescriptionOutput['rubricPrescriptions'] {
  return (['MESSAGE', 'EXPERIENCE', 'REACH'] as const).map(name => ({ name,
    rubricPrompt: formatCombinedRepairGuidance(prescriptions.flatMap(prescription => {
      const members = flags.filter(flag => flag.flagKey === prescription.flagKey && flag.rubric === name)
      if (!members.length) return []
      return [{ problem: members[0].problem, fix: prescription.fix,
        scopes: members.map(source => ({ problem: source.problem, evidence: source.evidence, pageUrl: source.pageUrl,
          verificationRule: source.verificationRule, supportingEvidence: source.supportingObservations?.map(observation => JSON.stringify(observation)) })) }]
    })), cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null }))
}

export function parsePrescriptionGuidance(raw: unknown, flags: readonly ExistingFlagForPrescription[]): PrescriptionOutput {
  const parsed = providerSchema(flags).safeParse(raw)
  if (!parsed.success) throw new Error('Invalid prescription output: ' + parsed.error.issues.map(issue => `${issue.path.map(String).join('.')}: ${issue.message}`).join('; '))
  const flagPrescriptions = Object.entries(parsed.data.flagPrescriptions).map(([flagKey, task]) => {
    const source = flags.find(flag => flag.flagKey === flagKey)!
    let fix: string, agentPrompt: string | null
    if ('inspection' in task) {
      if (Object.values(task).some(value => typeof value === 'string' && /[\r\n]/.test(value)))
        throw new Error(`Invalid prescription output: ${flagKey} requires concise single-line inspection fields`)
      if (/^(?:review|inspect|confirm|check|assess|evaluate|compare)\b/i.test(task.inspection.trim()) || /^(?:if|when|before|unless)\b/i.test(task.changeCondition.trim()))
        throw new Error(`Invalid prescription output: ${flagKey} needs inspection subjects and conditions, not prewritten commands`)
      validateTaskText([task.inspection, task.changeCondition, task.changeIfConfirmed || '', task.preserve], source)
      fix = formatInspectionGuidance(task); agentPrompt = null
    } else {
      if ([task.fix, task.agentPrompt || ''].some(value => value.split('\n').filter(line => line.trim()).length > 8))
        throw new Error(`Invalid prescription output: ${flagKey} exceeds eight repair steps`)
      validateTaskText([task.fix, task.agentPrompt || ''], source)
      fix = task.fix; agentPrompt = task.agentPrompt
    }
    return { flagKey, evidence: source.evidence, whyItMatters: source.whyItMatters || '', verificationRule: source.verificationRule || C.verificationUnavailable,
      fix, agentPrompt, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null }
  })
  return { flagPrescriptions, rubricPrescriptions: composePrescriptionRubrics(flags, flagPrescriptions) }
}
