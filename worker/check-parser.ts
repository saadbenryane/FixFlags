import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import { parseMetadataFromHtml } from '../lib/audit/metadata'
import { evaluateSearch } from '../lib/audit/search/registry'
import { searchReceiptSchema, searchPageEvidenceSchema } from '../lib/audit/search/contracts'

const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('metadata'), html: z.string().max(1_000_000), url: z.string().url() }).strict(),
  z.object({ operation: z.literal('search'), evidence: searchPageEvidenceSchema, previous: searchReceiptSchema.nullish(), evaluators: z.array(z.string()).max(6).optional() }).strict(),
])
async function main(message: unknown) {
  const input = inputSchema.parse(message)
  const result = input.operation === 'metadata' ? parseMetadataFromHtml(input.html, input.url)
    : await evaluateSearch(input.evidence, input.previous, input.evaluators)
  parentPort!.postMessage(result)
}
parentPort!.on('message', message => { void main(message).catch(() => process.exit(1)) })
