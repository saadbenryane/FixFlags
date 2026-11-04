import { z } from 'zod'

const user = z.object({ id: z.string().min(1) })
const token = z.string().min(1)
/** Email signup may confirm an account while still awaiting verification. */
export const emailAuthReceipt = z.object({ user, token: token.nullable() })
export const tokenSessionReceipt = emailAuthReceipt.extend({ token })
/** The passkey SDK returns its issued session separately from the user. */
export const passkeySessionReceipt = z.object({ user, session: z.object({ id: z.string().min(1), token, userId: z.string().min(1) }) })
  .refine(receipt => receipt.session.userId === receipt.user.id)
