import { Prisma } from '@prisma/client'
import { checkReceiptSchema } from './receipt'
import { readConsoleContext } from '../console-evidence'
import { slowActionContextSchema } from '../flow/slow-replay-contract'
import { currentSecurityHeaderTarget } from './security-headers'
import { currentKeyboardFocusTarget } from './keyboard'
import { currentTrackingRequestTarget } from '../tracking/identity'
import { matchesRecordedVerifierPage } from '@/lib/improvements/verifier-scope'

type Receipt = ReturnType<typeof checkReceiptSchema.parse>

/** This is a candidate filter, never a comparison or a recovery verdict. The
 * existing verifier must still qualify the original conditions independently. */
export function verificationContexts(targets: readonly unknown[]) {
  const exact = new Set<string>(), consoleWindows = new Set<string>()
  for (const value of targets) {
    if (!Array.isArray(value)) continue
    for (const target of value) {
      if (!target || typeof target !== 'object' || typeof target.context !== 'string') continue
      exact.add(currentTrackingRequestTarget(currentKeyboardFocusTarget(currentSecurityHeaderTarget(target.context))))
      const window = readConsoleContext(target.context)
      if (window) consoleWindows.add(window.key)
      try {
        const slow = slowActionContextSchema.safeParse(JSON.parse(target.context))
        if (slow.success && slow.data.captureKey) exact.add('slow-replay:v2:' + slow.data.captureKey)
      } catch { /* Ordinary contexts are not serialized slow-action identities. */ }
    }
  }
  return { exact: [...exact], consoleWindows: [...consoleWindows] }
}

/** Read all relevant immutable observations in bounded pages. Prune unrelated
 * assertions in PostgreSQL so a large execution does not transfer its journals
 * or every other control's evidence into each fenced observation transaction. */
export async function verificationEvidence(input: {
  receipt: Receipt; targets: readonly unknown[]; assertionKeys: readonly string[];
}, tx: Prisma.TransactionClient): Promise<Receipt[]> {
  const { receipt } = input
  if (!receipt.execution || !input.assertionKeys.length) return []
  const contexts = verificationContexts(input.targets)
  if (!contexts.exact.length) return []
  const sources: Receipt[] = []
  let after = ''
  const size = 128
  for (;;) {
    const rows = await tx.$queryRaw<Array<{ id: string; pageUrl: string | null; detail: unknown }>>(Prisma.sql`
      SELECT source."id", source."pageUrl", (SELECT jsonb_object_agg(field.key, field.value)
        FROM jsonb_each(CASE WHEN jsonb_typeof(source.detail) = 'object' THEN source.detail ELSE '{}'::jsonb END) AS field
        WHERE field.key IN ('kind', 'version', 'module', 'passed', 'applicable', 'failed', 'complete', 'limitation', 'pageUrl', 'execution'))
        || jsonb_build_object('assertions', selected.assertions) AS detail
      FROM "audit_verifier_executions" source
      CROSS JOIN LATERAL (
        SELECT jsonb_agg(assertion ORDER BY position) AS assertions
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source."detail"->'assertions') = 'array'
          THEN source."detail"->'assertions' ELSE '[]'::jsonb END) WITH ORDINALITY AS items(assertion, position)
        WHERE assertion->>'key' = ANY(${[...input.assertionKeys]}::text[]) AND (
          assertion->>'context' = ANY(${contexts.exact}::text[]) OR
          regexp_replace(assertion->>'context', ':window:[0-9]+$', '') = ANY(${contexts.consoleWindows}::text[]) OR
          EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(assertion->'targets') = 'array'
            THEN assertion->'targets' ELSE '[]'::jsonb END) AS target
            WHERE target->>'context' = ANY(${contexts.exact}::text[]))
        )
      ) selected
      WHERE source."auditId" = ${receipt.execution.auditId} AND source."targetKey" = ${'module:' + receipt.module}
        AND source.status = 'COMPLETED' AND source."id" > ${after} AND selected.assertions IS NOT NULL
        AND source.detail->>'module' = ${receipt.module}
        AND source.detail->'execution'->>'auditId' = ${receipt.execution.auditId}
        AND (source."taskId" IS NULL OR source."taskId" = source.detail->'execution'->>'taskId')
        AND source.detail->'execution'->>'source' = ${receipt.execution.source}
        AND source.detail->'execution'->>'checkVersion' = ${String(receipt.execution.checkVersion)}
      ORDER BY source."id" LIMIT ${size}`)
    for (const row of rows) {
      const parsed = checkReceiptSchema.safeParse(row.detail)
      if (parsed.success && matchesRecordedVerifierPage(row.pageUrl, parsed.data.pageUrl)) sources.push(parsed.data)
    }
    if (rows.length < size) return sources
    after = rows.at(-1)!.id
  }
}
