export interface PreviewMeta {
  title: string | null
  description: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  url: string
}

export function parsePreviewMeta(
  htmlMetadata: unknown,
  url: string
): PreviewMeta | null {
  if (!htmlMetadata || typeof htmlMetadata !== 'object') return null
  const data = htmlMetadata as Record<string, unknown>
  return {
    title: typeof data.title === 'string' ? data.title : null,
    description: typeof data.description === 'string' ? data.description : null,
    ogTitle: typeof data.ogTitle === 'string' ? data.ogTitle : null,
    ogDescription: typeof data.ogDescription === 'string' ? data.ogDescription : null,
    ogImage: typeof data.ogImage === 'string' ? data.ogImage : null,
    url,
  }
}

export function truncatePreview(text: string | null, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function displayHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
