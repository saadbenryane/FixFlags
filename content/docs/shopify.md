## What it adds

Shopify is an optional integration for the Site that represents your store. It adds product information and independent checks from selected saleable products through cart and checkout entry. Purchase-path failures can appear with the Site's Conversion evidence and Flags.

FixFlags stops before payment. Reaching checkout does not prove that payment, order creation, fulfillment, or every product works.

## Before you connect

- Sign in to FixFlags and [save your store's Site](/help/getting-started/save-your-site) to your account.
- Have access to authorize the FixFlags app for your Shopify store.
- Find the store's `your-store.myshopify.com` domain. Use that domain in the connection field, even if customers visit a custom domain.
- Publish an active product with an online storefront URL and an available variant for purchase-path discovery. A password gate or bot challenge can prevent verification.

One Shopify store can be attached to one FixFlags Site, and a Site can have one Shopify connection. A store attached elsewhere is not reassigned by matching its hostname.

## Permissions and data

FixFlags requests `read_products` access. It reads store details and product information to select eligible storefront paths. This connection does not request order or customer access and does not edit products or place orders.

Authorized access is stored encrypted. The embedded app verifies the Shopify session before loading private store data. A store installation alone does not grant access to an owned FixFlags Site.

## Connect

1. [Open your Sites](/dashboard) and select your store's Site.
2. Open **Settings → Connections → Shopify**.
3. Enter the store's `myshopify.com` domain and choose **Connect Shopify**.
4. Review and approve the requested access in Shopify.
5. Return to the Site's settings and confirm the connection.

Start authorization from Site settings so the store is attached to the Site you own. The connection link is single-use and expires after 15 minutes. If it expires, start again from settings.

If you installed the app in Shopify first, open FixFlags, sign in, save the store's Site, and follow these steps to finish attaching it. The embedded app shows **Finish connecting this store to a Site** until that attachment exists.

## Confirm the connection

Site settings shows **Connected to** followed by the store domain. The embedded app offers **Open Site** once attached. Confirm that both point to the intended store and Site.

FixFlags automatically discovers up to two eligible product paths during installation. Open the app in Shopify to see **Purchase paths**, the last check time, and the current result. **Check path again** starts another check when no check is pending and the manual limit permits it.

## Coverage and limitations

Purchase-path checks exercise selected product pages, buy controls, cart behavior, and checkout entry. Only the paths actually checked have evidence. Unsupported buy controls, password gates, bot walls, timeouts, and inconsistent attempts can leave the result unclear.

An unclear result does not certify recovery or make an untested path healthy. Read the Flag's affected path, capture time, and limitations, then use [Verify](/docs/site-care#verify) after publishing a fix.

Site Watch and the Shopify app's purchase-path checks have separate schedules. The app currently schedules discovered paths for six-hour checks and shorter availability checks. Installing Shopify does not activate the Site's Watch schedule; manage that separately in Site settings.

## Reconnect or disconnect

If settings says **The previous installation is unavailable**, choose **Connect Shopify** again and approve access.

**Disconnect** in FixFlags removes the attachment between that store and the Site. It does not uninstall the app or stop the app's separate purchase-path schedule. To remove the store authorization and stop those checks, uninstall FixFlags in Shopify admin as well.

Uninstalling clears stored access tokens and stops the app's scheduled path checks. It does not delete your FixFlags account or the rest of your Site. Reinstall and reconnect from the intended Site if you want to restore access. See [Shopify access and removal](/help/shopify/shopify-access-and-removal) for privacy and deletion help.

## Troubleshooting

- **Invalid store domain:** use the original `myshopify.com` domain, not the storefront's custom domain.
- **Expired or interrupted authorization:** open Site settings and start a new connection. Do not reuse an old authorization link.
- **Store already connected elsewhere:** use the account and Site that own the connection, disconnect there if appropriate, or contact support. A hostname cannot transfer ownership.
- **Site already has a Shopify connection:** disconnect the existing store before attaching another.
- **No buyable product found:** confirm an active product has a storefront URL and an available variant. Contact support if eligible published products still do not appear; there is no product-selection control in the current app.
- **Installation authorized but no Site attached:** complete the connection from an owned Site's settings.
- **Blocked or unclear check:** read the limitation, resolve a temporary storefront restriction when appropriate, and check the path again. Zero Flags does not establish complete coverage.
- **Shopify controls missing or temporarily unavailable:** the connection is unavailable on this server. Contact support.

## Get help

Use [Shopify connection help](/help/shopify/connect-shopify) or email [hello@fixflags.com](mailto:hello@fixflags.com). Include the Site, store domain, and the step that failed. Do not send passwords, access tokens, or customer payment data.
