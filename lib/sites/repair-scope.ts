import { z } from 'zod'
import { SITE_CARD_AREAS } from './card-areas'

export const MAX_REPAIR_TASKS = 100
export const REPAIR_TASKS_PER_PAGE = 25
export const MAX_REPAIR_MANIFEST_TASKS = 5000
export const repairScopeSchema = z.object({
  area: z.enum(SITE_CARD_AREAS).optional(),
  flagIds: z.array(z.string().min(1).max(200)).min(1).max(MAX_REPAIR_TASKS)
    .refine(ids => new Set(ids).size === ids.length, 'Choose each Flag once.').optional(),
}).strict()

export const repairBundlePageSchema = z.object({
  ...repairScopeSchema.shape,
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  offset: z.number().int().min(0).max(MAX_REPAIR_MANIFEST_TASKS).default(0),
}).strict().refine(value => value.offset === 0 || Boolean(value.manifestHash), 'Continuation requires its scope revision.')

export const repairManifestSchema = z.object({
  schemaVersion: z.literal('fixflags.repair-manifest.v1'), hash: z.string().regex(/^[a-f0-9]{64}$/),
  total: z.number().int().min(1).max(MAX_REPAIR_MANIFEST_TASKS), offset: z.number().int().min(0),
  returned: z.number().int().min(1).max(REPAIR_TASKS_PER_PAGE),
  next: z.object({ method: z.literal('POST'), url: z.string().url(), body: repairBundlePageSchema }).strict().nullable(),
}).strict()
