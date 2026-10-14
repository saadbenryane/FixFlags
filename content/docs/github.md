## What it adds

GitHub account authorization is available. FixFlags stores your authorization encrypted. You can use a Flag’s evidence and fix prompt in your code workflow, then verify the deployed website independently.

## Before you connect

Sign in to FixFlags. GitHub requests the **repo** permission, which grants access to public and private repositories. Review that permission on GitHub before authorizing.

## Connect

Open your Site’s **Integrations**, choose **Manage GitHub connection**, then **Connect GitHub**. You can also open [GitHub connection settings](/settings/integrations) directly.

## Confirm the connection

After authorization, settings shows the connected GitHub username. Saved authorization is separate from a passing website check.

## Coverage and limitations

FixFlags does not inspect code or open pull requests in the website beta. Connecting does not verify a fix. Fix prompts and website verification also work without a GitHub connection.

## Permissions and data

The authorization belongs to your FixFlags account. It is separate from GitHub sign-in, which you manage in [account settings](/settings).

## Reconnect or disconnect

Reconnect to replace an expired or revoked authorization. Disconnect removes the saved grant and any existing code checks and fixes in its history. FixFlags requests external revocation and reports whether GitHub confirmed it. If revocation is unconfirmed, remove the FixFlags authorization in [GitHub settings](https://github.com/settings/applications).

## Troubleshooting

An expired authorization request needs a new connection. If setup is unavailable, settings explains that provider configuration is missing. No existing authorization is replaced when a connection fails.

## Get help

Read [Help](/help) or [Open your Sites](/dashboard). Other integrations remain [coming soon](/integrations).
