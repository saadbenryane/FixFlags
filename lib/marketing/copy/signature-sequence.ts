import { PRODUCT_STORY } from './product-story'

const [CHECK, FLAG, FIX, VERIFY] = PRODUCT_STORY.loop

/** The homepage signature sequence: one sample Flag on a controlled demo store, from check to verified fix. */
export const SIGNATURE_SEQUENCE = {
  label: 'Sample check on a controlled demo store',
  sampleNote: 'Sample data',
  controls: { pause: 'Pause', play: 'Play', replay: 'Replay', steps: 'Sample check steps' },
  browser: {
    url: 'everydaygoods.example/products/canvas-tote',
    capture: '/marketing/evidence/cart-empty.png',
    captureAlt: 'Everyday Goods Canvas Tote product page. The cart still reads 0 after Add to cart was selected.',
    action: 'Add to cart',
    log: ['Opened /products/canvas-tote', 'Selected Add to cart', 'Waiting for the cart to update'],
    logTitle: 'Checking everydaygoods.example',
    logState: 'Running',
    after: '/marketing/evidence/purchase-verified.png',
    afterAlt: 'Canvas Tote page on a phone after the fix: Added to cart, and 1 item is in the cart.',
    afterLabel: 'Recheck on the live site',
  },
  steps: [
    { id: 'check', tab: CHECK, caption: 'We open your live site and try it like a visitor.' },
    { id: 'flag', tab: FLAG, caption: 'Anything broken gets a Flag, with the evidence.' },
    { id: 'fix', tab: FIX, caption: 'Paste the fix instructions into your AI tool.' },
    { id: 'verify', tab: VERIFY, caption: 'We recheck the live site and keep the receipt.' },
  ],
  flag: {
    label: 'Flag',
    title: 'Add to cart didn’t add the product',
    facts: [
      { label: 'What happened', value: 'The button responds, but the cart stays empty.' },
      { label: 'What should happen', value: 'The product appears in the cart and checkout opens.' },
    ],
  },
  fix: {
    tool: 'Claude Code',
    command: 'Fix this FixFlags Flag',
    lines: [
      'Page: /products/canvas-tote',
      'Action: select Add to cart',
      'What happened: the button responds, but the cart stays empty.',
      'What should happen: the product appears in the cart and checkout opens.',
      'Stop before submitting payment or placing an order.',
    ],
    copy: 'Copy fix instructions',
    copied: 'Copied',
  },
  receipt: {
    stamp: 'Verified',
    title: 'Add to cart works again',
    rows: [
      { label: 'Page', value: '/products/canvas-tote' },
      { label: 'Action', value: 'Add to cart' },
      { label: 'Before', value: 'Cart stayed empty' },
      { label: 'After', value: 'Canvas Tote in cart' },
      { label: 'Rechecked', value: 'Live site, 14 Sep 09:14 UTC' },
    ],
    note: 'Independent recheck. No payment or order was made.',
  },
} as const

export type SignatureStepId = (typeof SIGNATURE_SEQUENCE.steps)[number]['id']
