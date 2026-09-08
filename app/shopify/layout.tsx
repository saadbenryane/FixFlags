import Script from 'next/script'
import { shopifyApiKey } from '@/lib/shopify/config'

export const metadata = {
  title: 'FixFlags',
  robots: { index: false, follow: false },
}

export default function ShopifyAppLayout({ children }: { children: React.ReactNode }) {
  const apiKey = shopifyApiKey()
  return (
    <div className="min-h-screen bg-background text-foreground">
      {apiKey ? <meta name="shopify-api-key" content={apiKey} /> : null}
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      {children}
    </div>
  )
}
