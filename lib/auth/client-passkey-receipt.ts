import { z } from 'zod'

export const passkeyListReceipt = z.array(z.object({
  id: z.string().min(1),
  createdAt: z.union([z.string(), z.date()]).nullish(),
  deviceType: z.string().nullish(),
  backedUp: z.boolean().optional(),
})).refine(rows => new Set(rows.map(row => row.id)).size === rows.length)

export const passkeyCreatedReceipt = z.object({ id: z.string().min(1) })
