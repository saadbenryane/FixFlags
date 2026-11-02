/** Bound each process pool without overriding a smaller explicit pool. */
export function budgetDatabaseUrl(connectionString, role = 'web') {
  if (!connectionString) return connectionString
  const url = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) return connectionString
  const ceiling = role === 'worker' ? 10 : 5
  const configured = Number(url.searchParams.get('connection_limit'))
  url.searchParams.set('connection_limit', String(Number.isInteger(configured) && configured > 0 ? Math.min(configured, ceiling) : ceiling))
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10')
  return url.toString()
}
