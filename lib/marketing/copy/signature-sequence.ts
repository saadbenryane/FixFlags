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
  },
  steps: [
    { id: 'check', tab: 'Check', caption: 'FixFlags opens the product page in a real browser and selects Add to cart.' },
    { id: 'flag', tab: 'Flag', caption: 'Nothing was added. The Flag lands on the button that failed, with the evidence.' },
    { id: 'fix', tab: 'Fix', caption: 'Copy the fix instructions into the AI tool you build with.' },
    { id: 'verify', tab: 'Verify', caption: 'After you publish, FixFlags checks the same page and action again on the live site.' },
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
