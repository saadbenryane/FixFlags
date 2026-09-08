export const SHOPIFY_APP = {
  listingTitle: 'FixFlags: Purchase Path Monitor',
  listingSubtitle: "Know when customers can't buy",
  badge: 'Shopify',
  installCta: 'Install on Shopify',
  compactInstallCta: 'Install',
  secondaryCta: 'See how it works',
  shopPlaceholder: 'your-store.myshopify.com',
  shopLabel: 'Shopify store domain',
  continueCta: 'Continue to Shopify',
  notConfigured:
    'The Shopify app is not configured in this environment yet. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET to install.',
} as const

export const HEALTH_COPY = {
  GREEN: {
    label: 'Can buy',
    short: 'Customers can reach checkout.',
  },
  RED: {
    label: "Can't buy",
    short: 'Confirmed twice. The path failed.',
  },
  UNKNOWN: {
    label: 'Unclear',
    short: 'We could not prove the path. We do not guess.',
  },
} as const

export const REASON_COPY: Record<string, string> = {
  checkout_reached: 'A stranger reached checkout. We stopped before payment.',
  http_error: 'The page returned an error status.',
  soft_unavailable: 'The product looked unavailable.',
  buy_control_unclickable: 'The buy button could not be used.',
  add_to_cart_noop: 'Add to cart did not put the product in the cart.',
  checkout_error: 'Checkout showed an error.',
  no_buy_control: 'No add to cart or buy control was found.',
  bot_wall: 'A bot check blocked the walk.',
  password_gate: 'The storefront is password gated.',
  timeout: 'The walk timed out before checkout.',
  flaky: 'One walk failed and the retry recovered. Marked unclear.',
  probe_error: 'The walk hit an internal error.',
}

export const STEP_COPY: Record<string, string> = {
  landing: 'Product',
  variant: 'Variant',
  add_to_cart: 'Add to cart',
  cart: 'Cart',
  checkout: 'Checkout',
  failure: 'Failed step',
}
