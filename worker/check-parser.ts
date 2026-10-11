import { parentPort, workerData } from 'node:worker_threads'
import { z } from 'zod'
import { parseMetadataFromHtml } from '../lib/audit/metadata'
import { evaluateSearch } from '../lib/audit/search/registry'
import { searchReceiptSchema, type SearchPageEvidence } from '../lib/audit/search/contracts'
import { publicDocumentSchema } from '../lib/audit/progressive/snapshots'

const evidenceSchema = z.object({ auditId: z.string(), pageUrl: z.string().url(), collectedAt: z.string().datetime(), public: z.boolean(),
  original: publicDocumentSchema, rendered: publicDocumentSchema, robots: publicDocumentSchema,
  sitemaps: z.array(publicDocumentSchema).max(5), sitemapUrls: z.array(z.string().url()).max(10_000),
  sitemapsComplete: z.boolean(), declaredSitemaps: z.array(z.string()).max(10_000), canonicalTargets: z.array(publicDocumentSchema).max(3) }).strict()
const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('metadata'), html: z.string().max(1_000_000), url: z.string().url() }).strict(),
  z.object({ operation: z.literal('search'), evidence: evidenceSchema, previous: searchReceiptSchema.nullish() }).strict(),
])
async function main() {
  const input = inputSchema.parse(workerData.input)
  const result = input.operation === 'metadata' ? parseMetadataFromHtml(input.html, input.url)
    : await evaluateSearch(input.evidence as SearchPageEvidence, input.previous)
  parentPort!.postMessage(result)
}
void main()
