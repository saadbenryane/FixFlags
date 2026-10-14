export const SHOPIFY_CONNECTION_RECOVERY = {
  not_configured: 'Shopify connections are temporarily unavailable. Contact support if the controls are missing from Integrations.',
  missing: 'The connection did not finish. Try again from Integrations for your saved website.',
  hmac: 'The Shopify connection could not be confirmed. Start again from Integrations.',
  state: 'This connection link is invalid or expired. Start again from Integrations.',
  token: 'The store could not be connected to your website. Try again from Integrations, or contact support if the store is already connected elsewhere.',
  fixture_shop: 'The store could not be identified. Use its original myshopify.com address in Integrations.',
} as const

export const SHOPIFY_GUIDE_RECOVERY = {
  title: 'Shopify connection did not finish',
  openSites: 'Open your Sites',
  nextStep: 'Select your website, then open Integrations to try again.',
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
