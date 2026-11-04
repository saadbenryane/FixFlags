import { z } from 'zod'

/** Account display facts shared by the server serializer and client session owner. */
export const meUserSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string().nullable().optional(),
  plan: z.string(),
  role: z.string(),
  isAdmin: z.boolean(),
  checks: z.object({
    used: z.number(), pending: z.number(), limit: z.number().nullable(), isUnlimited: z.boolean(),
    purchasedCredits: z.number().optional(), totalAvailable: z.number().nullable().optional(),
    remaining: z.number().nullable(), periodStart: z.string(), periodEnd: z.string(),
  }).passthrough(),
  entitlements: z.object({
    canExportSummary: z.boolean(), canAccessPaidFeatures: z.boolean(),
    canMonitor: z.boolean(), canWatchProduct: z.boolean(),
  }).passthrough(),
  vibecodingLevel: z.string().nullable(),
  preferredTools: z.array(z.string()),
}).passthrough()

export type MeUser = z.infer<typeof meUserSchema>
export const meResponseSchema = z.object({ user: meUserSchema.nullable() }).passthrough()
export const meClaimResponseSchema = meResponseSchema.extend({ claimedCount: z.number().int().nonnegative() })
