export const SHOPIFY_CONNECTION_RECOVERY = {
  not_configured: 'Shopify connections are temporarily unavailable. Contact support if the controls are missing from Site settings.',
  missing: 'Authorization was incomplete. Start a new connection from the Site you own.',
  hmac: 'The Shopify authorization could not be verified. Start a new connection from Site settings.',
  state: 'This authorization link is invalid or expired. Start a new connection from Site settings.',
  token: 'Authorization or Site attachment could not finish. Retry from Site settings, or contact support if the store is already attached elsewhere.',
  fixture_shop: 'The store could not be identified. Use the store’s myshopify.com domain in Site settings.',
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
