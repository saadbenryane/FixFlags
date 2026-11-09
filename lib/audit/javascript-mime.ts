// JavaScript MIME type essences shared by HTML script declarations and Fetch.
const JAVASCRIPT_TYPES = new Set([
  'application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
  'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript',
  'text/x-ecmascript', 'text/x-javascript',
])

export function isJavaScriptMimeType(essence: string | undefined): boolean {
  return essence !== undefined && JAVASCRIPT_TYPES.has(essence)
}
