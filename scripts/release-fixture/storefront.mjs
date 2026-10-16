/** Explicit controlled failures for the published repair demonstration. */
export function storefrontContent(config) {
  const search = config.unlabelledSearch
    ? '<input type="search" name="q" required><button type="submit"></button>'
    : '<label>Find equipment<input type="search" name="q" required></label><button type="submit">Search equipment</button>'
  return `<h1>Equipment for your next outdoor adventure</h1><p>Trail Pack, $75. Choose your hiking pack and review checkout.</p>
    <button type="button" id="add">Add to cart</button><div id="CartDrawer" hidden><p>Item added</p><p>Your cart (1)</p><a href="/checkout">Checkout</a></div>
    <script>document.getElementById("add").onclick=()=>{document.getElementById("CartDrawer").hidden=false}</script>
    <nav><a href="/pricing">Equipment pricing</a><a href="/signup">Create account</a><a href="/login">Log in</a></nav>
    <form method="get" action="/search">${search}</form>`
}

export function pricingResponse(config) {
  return config.brokenPricing
    ? { status: 404, content: '<h1>Equipment pricing unavailable</h1><p>This is a controlled broken destination.</p>' }
    : { status: 200, content: '<h1>Equipment pricing</h1><p>Trail Pack costs $75. Review your pack and checkout.</p><a href="/">View equipment</a>' }
}
