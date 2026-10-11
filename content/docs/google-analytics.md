## What it adds

Google Analytics adds page-session counts beside the Site's Tracking context and matching page Flags. These numbers help explain which pages people visit. FixFlags still checks the live website independently.

## Before you connect

- Sign in and [save the Site](/help/getting-started/save-your-site) to your FixFlags account.
- Use a Google account that can read the intended Google Analytics property.
- Ensure the property has a website data stream whose configured website hostname matches the Site. FixFlags matches hostnames and treats `www` and the apex hostname as equivalent.

FixFlags chooses a matching property automatically. The current interface does not offer a manual property picker.

## Permissions and data

FixFlags requests read-only Analytics access (`analytics.readonly`). It reads accessible property and website-stream information, then page paths and aggregate session counts. It does not change your Analytics configuration or install a tracking script.

Access tokens are stored encrypted. The connection belongs to the owned Site. It does not import individual visitor identities or session recordings.

## Connect

1. [Open your Sites](/dashboard) and select the website.
2. Open **Settings → Connections → Analytics**.
3. Choose **Connect Analytics**.
4. Select the Google account with property access and approve read-only access.
5. Return to Site settings to check the result.

## Confirm the connection

A successful connection shows the matched **Property**, connection detail, and **Last read** time in settings. Page-specific session context appears where FixFlags has matching page data.

**No Analytics property matches this Site** means authorization succeeded but the available website streams did not match. It does not mean the Site has no visitors.

## Coverage and limitations

The current report reads up to 25 page rows for the last 28 days through yesterday. It is a bounded snapshot, not a complete traffic dashboard or a live event feed. Check **Last read** before treating numbers as current. Zero sessions is different from an absent row or failed read.

This integration does not currently validate signup or purchase events, analyze funnels, import revenue, or resolve a Flag from traffic numbers. A connected property can return no rows if it has no data in the requested period. FixFlags does not invent missing counts.

## Reconnect or disconnect

Use **Reconnect** when access expires, is revoked, or no property matches. Confirm the Google account has access and the website stream uses the intended hostname, then authorize again.

Choose **Disconnect** in Site settings to remove the stored credentials and stop using the connection. Earlier saved numbers remain dated historical data; they are not fresh proof. To change accounts or correct an incorrectly matched property, disconnect and connect again with the intended account.

## Troubleshooting

- **No matching property:** check account access and the website data stream's URL. A related subdomain is not automatically the same Site.
- **Wrong property matched:** use an account whose accessible matching property is the intended one, then reconnect. Contact support if multiple properties still match.
- **Connected but no numbers:** check whether the property has page-session data for the last 28 days. An absent row does not prove zero traffic.
- **Access expired or denied:** reconnect with an account that can read the property and approve the requested permission.
- **Old Last read time:** disconnect and connect again to read the current snapshot. There is no manual refresh control in the current interface.
- **Interrupted authorization:** start again from Site settings rather than reusing an old link.
- **Controls missing:** Google connections may be unavailable on the current FixFlags server. Contact support.

## Get help

Visit [Google connection help](/help/getting-started/connect-google-data) or email [hello@fixflags.com](mailto:hello@fixflags.com). Include the Site, property name, status, and Last read time. Do not send Google passwords or access tokens.
