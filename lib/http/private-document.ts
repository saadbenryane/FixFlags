const privatePaths = ['/share', '/reset-password', '/cli/authorize', '/sites', '/report', '/compare']
const authContinuationPaths = ['/sign-in', '/sign-up', '/two-factor', '/post-login']

export function isPrivateDocumentPath(pathname: string): boolean {
  return privatePaths.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export function isAuthContinuationPath(pathname: string): boolean {
  return authContinuationPaths.some(path => pathname === path || pathname === `${path}/`)
}

export function carriesPrivateContinuation(pathname: string, params: Pick<URLSearchParams, 'getAll'>): boolean {
  if (!isAuthContinuationPath(pathname)) return false
  const base = 'https://auth-continuation.invalid'
  return params.getAll('next').some(next => {
    if (!next.startsWith('/') || !URL.canParse(next, base)) return false
    const target = new URL(next, base)
    return target.origin === base && isPrivateDocumentPath(target.pathname)
  })
}
