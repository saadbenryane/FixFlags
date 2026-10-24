import { z } from 'zod'
import { SITE_CARD_AREAS } from './card-areas'

export const MAX_REPAIR_TASKS = 100
export const repairScopeSchema = z.object({
  area: z.enum(SITE_CARD_AREAS).optional(),
  flagIds: z.array(z.string().min(1).max(200)).min(1).max(MAX_REPAIR_TASKS)
    .refine(ids => new Set(ids).size === ids.length, 'Choose each Flag once.').optional(),
}).strict()
