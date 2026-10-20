/** Verification tokens are optional public metadata, never substitutes for provider ownership checks. */
export function siteVerification(env: { GOOGLE_SITE_VERIFICATION?: string; BING_SITE_VERIFICATION?: string } = { GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION: process.env.BING_SITE_VERIFICATION }) {
  const token = (value: string | undefined) => value?.trim() && value.trim().length <= 256 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : undefined
  const google = token(env.GOOGLE_SITE_VERIFICATION)
  const bing = token(env.BING_SITE_VERIFICATION)
  return { ...(google ? { google } : {}), ...(bing ? { other: { 'msvalidate.01': bing } } : {}) }
}
