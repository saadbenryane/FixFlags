import { z } from 'zod'

export const scanAccessOriginSchema = z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol))
/** Permission metadata contains no credentials and is safe in a frozen execution intent. */
export const scanAccessIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('public'), origin: scanAccessOriginSchema }).strict(),
  z.object({ kind: z.literal('explicit'), origin: scanAccessOriginSchema }).strict(),
  z.object({ kind: z.literal('project'), origin: scanAccessOriginSchema, projectId: z.string().min(1), reference: z.string().min(1).max(80) }).strict(),
])
export type ScanAccessIntent = z.infer<typeof scanAccessIntentSchema>
