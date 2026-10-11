## What it adds

Google Search Console adds query, impression, and click context beside the Site's Search context and matching page Flags. These numbers show search demand for pages. FixFlags independently checks the live website.

## Before you connect

- Sign in and [save the Site](/help/getting-started/save-your-site) to your FixFlags account.
- Use a Google account that can read a Search Console property for the website.
- Ensure a domain property or URL-prefix property matches the Site's hostname. FixFlags treats `www` and the apex hostname as equivalent; it does not assume that other subdomains belong to the same Site.

FixFlags chooses an accessible matching property automatically. The current interface does not offer a manual property picker.

## Permissions and data

FixFlags requests read-only Search Console access (`webmasters.readonly`). It reads accessible properties and aggregate search rows containing pages, queries, impressions, clicks, and position. It does not modify your property, submit a sitemap, or request indexing.

Access tokens are stored encrypted and attached to the owned Site. Search numbers provide context rather than verification of customer actions.

## Connect

1. [Open your Sites](/dashboard) and select the website.
2. Open **Settings → Connections → Search Console**.
3. Choose **Connect Search Console**.
4. Select the Google account with property access and approve read-only access.
5. Return to Site settings to check the result.

## Confirm the connection

A successful connection shows the matched **Property**, connection detail, and **Last read** time. Query, impression, and click context appears beside matching page evidence where rows exist.

**No Search Console property matches this Site** means the authorized account has no property that matches the hostname. It does not establish that Google has excluded the Site.

## Coverage and limitations

FixFlags requests a bounded set of up to 25 page-and-query rows over the last 28 days. This is a dated snapshot, not a complete export or a live search feed. Check **Last read** before treating it as current. A connected property can return no rows.

The integration does not currently run URL inspection, confirm indexing, diagnose sitemap exclusions, or detect ranking changes automatically. Missing rows do not prove that a page is unindexed, has zero impressions, or has no search demand. Search numbers do not resolve Flags.

## Reconnect or disconnect

Use **Reconnect** when access expires, is revoked, or the property does not match. Confirm account access and the property hostname, then authorize again.

Choose **Disconnect** in Site settings to remove stored credentials and stop using the connection. Earlier saved numbers remain dated historical data, not fresh proof. To change accounts or correct the property, disconnect and connect again with the intended account.

## Troubleshooting

- **No matching property:** check that the authorized account can access a property matching the Site's hostname.
- **Wrong property matched:** reconnect with an account that has access to the intended property. Contact support if several accessible properties match.
- **Connected but no numbers:** inspect the property's search data for the requested period. No returned rows is not proof that a page is unindexed.
- **Access expired or denied:** reconnect and approve read-only access using an account that can read the property.
- **Old Last read time:** disconnect and connect again to read the current snapshot. The current interface has no manual refresh control.
- **Interrupted authorization:** start again from Site settings instead of reusing an old link.
- **Controls missing:** Google connections may be unavailable on the current FixFlags server. Contact support.

## Get help

Visit [Google connection help](/help/getting-started/connect-google-data) or email [hello@fixflags.com](mailto:hello@fixflags.com). Include the Site, property, status, and Last read time. Do not send Google passwords or access tokens.
