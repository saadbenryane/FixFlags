import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { displayHostname, truncatePreview } from '@/lib/audit/preview-meta'

interface Props {
  preview: PreviewMeta
}

function SerpPreview({ preview }: Props) {
  const title = truncatePreview(preview.title ?? preview.ogTitle, 60)
  const description = truncatePreview(
    preview.description ?? preview.ogDescription,
    160
  )
  const hostname = displayHostname(preview.url)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Google search preview
      </p>
      <div className="rounded-card border-0 bg-card p-4 shadow-card space-y-1">
        <p className="text-xs text-muted-foreground">{hostname}</p>
        <p className="text-base text-link leading-snug">
          {title || 'Missing page title'}
        </p>
        <p className="text-sm text-muted-foreground leading-snug">
          {description || 'Missing meta description'}
        </p>
      </div>
    </div>
  )
}

function SocialPreview({ preview }: Props) {
  const title = preview.ogTitle ?? preview.title ?? 'Missing title'
  const description =
    preview.ogDescription ?? preview.description ?? 'Missing description'
  const showBrokenImage = Boolean(preview.ogImage) && !preview.ogImageOk

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Social link preview
      </p>
      <div className="rounded-card border-0 bg-card overflow-hidden shadow-card max-w-md">
        {preview.ogImage && preview.ogImageOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.ogImage}
            alt=""
            className="aspect-[1.91/1] w-full object-cover bg-muted"
          />
        ) : showBrokenImage ? (
          <div className="aspect-[1.91/1] w-full bg-muted flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground px-4 text-center">
            <span className="font-medium text-foreground">og:image broken</span>
            <span className="text-xs">The image URL does not load</span>
          </div>
        ) : (
          <div className="aspect-[1.91/1] w-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
            No og:image
          </div>
        )}
        <div className="p-3 space-y-1 border-t border-border/60">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
            {displayHostname(preview.url)}
          </p>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>
    </div>
  )
}

export function PreviewCards({ preview }: Props) {
  return (
    <section
      id="report-previews"
      className="scroll-mt-[var(--header-offset)] space-y-4"
      aria-labelledby="preview-cards-heading"
    >
      <div>
        <h2 id="preview-cards-heading" className="text-sm font-semibold tracking-heading">
          Share & search previews
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How your page may appear in search results and when shared on Slack or social.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SerpPreview preview={preview} />
        <SocialPreview preview={preview} />
      </div>
    </section>
  )
}
