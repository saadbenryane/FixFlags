import Link from 'next/link'
import { ShopifyInstallCta } from '@/components/marketing/ShopifyInstallCta'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { isShopifyConfigured } from '@/lib/shopify/config'
import { SHOPIFY_APP } from '@/lib/marketing/copy/shopify'

export const metadata = buildPageMetadata('install', '/install')

export default async function InstallPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const configured = isShopifyConfigured()

  return (
    <>
      <MarketingPageViewTracker page="/install" />
      <Section spacing="hero">
        <Container variant="marketing" className="max-w-2xl px-4 sm:px-6">
          <p className="text-sm font-medium text-brand">{SHOPIFY_APP.badge}</p>
          <Heading as="h1" className="mt-3 font-display text-4xl font-bold tracking-display">
            {SHOPIFY_APP.installCta}
          </Heading>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Connect Shopify to add commerce structure and independent purchase-path verification to your FixFlags Site.
          </p>
          <div className="mt-8">
            {configured ? (
              <ShopifyInstallCta idSuffix="-page" />
            ) : (
              <p className="text-sm text-muted-foreground">{SHOPIFY_APP.notConfigured}</p>
            )}
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive">
              Install did not finish. Try again, or email hello@fixflags.com.
            </p>
          ) : null}
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/protect" className="text-link">
              {SHOPIFY_APP.secondaryCta}
            </Link>
          </p>
        </Container>
      </Section>
    </>
  )
}
