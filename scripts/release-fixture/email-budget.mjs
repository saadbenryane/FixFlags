export function parseEmailBudget(value) {
  if (value === undefined || value === '') return 0
  if (!/^[0-5]$/.test(value)) throw new Error('Controlled email budget must be between zero and five')
  return Number(value)
}

export async function reserveVerificationEmail(db, limit) {
  if (limit === 0) return false
  const rows = await db.$queryRaw`UPDATE release_target_email_budget SET used = used + 1
    WHERE id = 1 AND used < ${limit} RETURNING used`
  return rows.length === 1
}
