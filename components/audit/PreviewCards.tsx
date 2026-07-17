import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { displayHostname, truncatePreview } from '@/lib/audit/preview-meta'
import { Card } from '@/components/ui/card'
import { LabelCaps, SectionTitle } from '@/components/ui/typography'

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
      <LabelCaps>Google search preview</LabelCaps>
      <Card className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{hostname}</p>
        <p className="text-base leading-snug text-link">{title || 'Missing page title'}</p>
        <p className="text-sm leading-snug text-muted-foreground">
          {description || 'Missing meta description'}
        </p>
      </Card>
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
      <LabelCaps>Social link preview</LabelCaps>
      <Card className="max-w-md overflow-hidden p-0">
        {preview.ogImage && preview.ogImageOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.ogImage}
            alt=""
            loading="lazy"
            className="aspect-[1.91/1] w-full bg-muted object-cover"
          />
        ) : showBrokenImage ? (
          <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center gap-1 bg-muted px-4 text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">og:image broken</span>
            <span className="text-xs">The image URL does not load</span>
          </div>
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
            No og:image
          </div>
        )}
        <div className="space-y-1 border-t border-border/60 p-3">
          <p className="text-3xs uppercase tracking-wide text-muted-foreground">
            {displayHostname(preview.url)}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </div>
      </Card>
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
        <SectionTitle id="preview-cards-heading">Share & search previews</SectionTitle>
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
