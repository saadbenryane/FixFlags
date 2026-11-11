import { PRODUCT_STORY } from './product-story'

const [CHECK, FLAG, FIX, VERIFY] = PRODUCT_STORY.loop

/**
 * The homepage story: one sample Flag on a controlled demo store, from check to verified fix.
 * The visitor scrolls through the steps while the same phone capture stays in view.
 */
export const SIGNATURE_SEQUENCE = {
  title: PRODUCT_STORY.loop.map(step => `${step}.`).join(' '),
  label: 'Sample check on a controlled demo store. No payment or order was made.',
  phone: {
    /** The Check step walks the store: its home page, then the product page, then the tap that fails. */
    home: '/marketing/evidence/store-home.png',
    ready: '/marketing/evidence/purchase-ready.png',
    before: '/marketing/evidence/purchase-broken.png',
    beforeAlt: 'Canvas Tote product page on a phone. Add to cart was selected, the cart shows 0 items, and checkout stays closed.',
    after: '/marketing/evidence/purchase-verified.png',
    afterAlt: 'Canvas Tote product page on a phone after the fix. The cart shows 1 item and Checkout is available.',
  },
  steps: [
    { id: 'check', tab: CHECK, caption: 'We open your live site and try it like a visitor.', points: ['A real browser', 'Phone and desktop', 'Your live site'] },
    { id: 'flag', tab: FLAG, caption: 'Anything broken gets a Flag, with the evidence.', points: ['Screenshot', 'What happened', 'What should happen'] },
    { id: 'fix', tab: FIX, caption: 'Paste the fix instructions into your AI tool.', points: [] },
    { id: 'verify', tab: VERIFY, caption: 'We recheck your live site ourselves and keep the receipt.', points: ['Same page', 'Same action', 'Before and after'] },
  ],
  /** The AI tools shown on the Fix step. */
  tools: ['Lovable', 'Bolt', 'Replit', 'Cursor', 'Claude Code'],
  toolsLabel: 'Works with',
  check: {
    title: 'Checking everydaygoods.example',
    state: 'Running',
    log: ['Opened the home page on a phone', 'Went to the Canvas Tote', 'Selected Add to cart', 'Waiting for the cart to update'],
  },
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
      'Expected: the product appears in the cart.',
      'Stop before payment or placing an order.',
    ],
    copy: 'Copy fix instructions',
    copied: 'Copied',
  },
  receipt: {
    stamp: 'Verified',
    title: 'Add to cart works again',
    rows: [
      { label: 'Before', value: 'Cart stayed empty' },
      { label: 'After', value: 'Canvas Tote in cart' },
      { label: 'Rechecked', value: 'Live site, 14 Sep 09:14 UTC' },
    ],
  },
  verifyAction: { label: 'See how verification works', href: '/how-it-works' },
} as const
